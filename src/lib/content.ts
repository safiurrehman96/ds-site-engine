/**
 * Ordered access to the payload's collections. Nav, footer, grids and sitemap all
 * read through here so ordering is defined once.
 */
import { getCollection, getEntry } from 'astro:content';

/**
 * Static routes that must never be shadowed by a payload slug. Both `services` and
 * `areas` render at `/{slug}`, so a collision either steals a page or silently wins
 * over a hand-built route depending on build order.
 */
const RESERVED_SLUGS = new Set([
  'about',
  'faqs',
  'get-quote',
  'privacy-policy',
  'tos',
  'styleguide',
]);

/**
 * Guards the one invariant the slug format used to imply.
 *
 * Area slugs were previously required to end in `-{st}`, which made a collision with
 * a service slug impossible by construction — and also made non-city service areas
 * impossible. Now that slugs are free-form, the collision has to be checked outright.
 */
function assertUniqueSlugs(
  services: Array<{ data: { slug: string } }>,
  areas: Array<{ data: { slug: string } }>,
): void {
  const seen = new Map<string, string>();
  const problems: string[] = [];

  for (const [collection, entries] of [
    ['services', services],
    ['areas', areas],
  ] as const) {
    for (const entry of entries) {
      const { slug } = entry.data;

      if (RESERVED_SLUGS.has(slug)) {
        problems.push(`  · "${slug}" (${collection}) collides with the static route /${slug}`);
        continue;
      }

      const owner = seen.get(slug);
      if (owner) {
        problems.push(`  · "${slug}" is used by both ${owner} and ${collection}`);
        continue;
      }

      seen.set(slug, collection);
    }
  }

  if (problems.length) {
    throw new Error(
      `Slug collisions in the payload — every page renders at /{slug}, so these overwrite each other:\n${problems.join('\n')}`,
    );
  }
}

export async function getServices() {
  const [services, areas] = await Promise.all([
    getCollection('services'),
    getCollection('areas'),
  ]);
  assertUniqueSlugs(services, areas);
  return services.sort((a, b) => a.data.order - b.data.order);
}

export async function getAreas() {
  const [services, areas] = await Promise.all([
    getCollection('services'),
    getCollection('areas'),
  ]);
  assertUniqueSlugs(services, areas);
  return areas.sort((a, b) => a.data.order - b.data.order);
}

/**
 * The one place an area turns into a display string.
 *
 * "{name}, {ST}" for US cities, bare `name` for everything else. Five call sites used
 * to interpolate `, ${state}` inline, which is exactly how a client whose areas are
 * airports ends up with "Teterboro Airport (KTEB), undefined" in the footer.
 */
export function areaLabel(area: { name: string; state?: string }): string {
  return area.state ? `${area.name}, ${area.state}` : area.name;
}

/** Singleton pages. Throw loudly rather than rendering an empty page. */
async function getSingleton<C extends 'home' | 'about' | 'faqs' | 'getQuote'>(
  collection: C,
  file: string,
) {
  const entry = await getEntry(collection, file);
  if (!entry) {
    throw new Error(
      `Missing payload file: client/content/${file}.md\n\n` +
        `If that file exists on disk, this is a stale dev server, not a missing file. ` +
        `Its content store was built for a different state of the payload and nothing ` +
        `invalidated it. Two things do that, and neither produces a watcher event:\n` +
        `  · the client link moved (pnpm use <slug>, or a DS_CLIENT=<slug> build or ` +
        `stress run in another terminal — those repoint client/ too). The glob resolves ` +
        `through the symlink to clients/<slug>/, so the watcher never sees the swap.\n` +
        `  · src/content.config.ts changed, which clears the store before it is rebuilt.\n\n` +
        `Either way: astro dev stop, then pnpm dev.`,
    );
  }
  return entry;
}

export const getHome = () => getSingleton('home', 'home');
export const getAbout = () => getSingleton('about', 'about');
export const getFaqs = () => getSingleton('faqs', 'faqs');
export const getGetQuote = () => getSingleton('getQuote', 'get-quote');

/**
 * Authored legal override. Returns undefined when the payload does not carry one,
 * which is the common case — the caller then falls back to the lib/legal.ts template.
 */
export async function getLegalDoc(id: 'privacy-policy' | 'tos') {
  return await getEntry('legal', id);
}

/** Splits an authored multi-paragraph string on blank lines. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------------------------
 * Prose block classification
 *
 * Payload copy is not markdown, but it is not flowing prose either. Authors write
 * three distinct shapes into the same string field, and the difference is the whole
 * reason copy-only sections used to look like a wall of grey text: a scannable spec
 * sheet was being rendered as an essay.
 *
 *   text   — an actual paragraph
 *   list   — a block whose every line begins with "- "
 *   points — a *run* of paragraphs opening "**Label.** explanation", which is a
 *            labelled list the author happened to type as prose
 *
 * Classifying here lets templates inspect the same structure their renderers use, so
 * layout and content agree on what the body is.
 * ------------------------------------------------------------------------ */

export type ProseBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'points'; items: ProsePoint[] };

export interface ProsePoint {
  label: string;
  body: string;
}

/**
 * A list this long stops reading as a sentence continued into bullets and starts
 * reading as an inventory, which is what earns it the two-column grid treatment.
 * Below the threshold a list stays inline under its introducing paragraph.
 */
/** A label longer than this is a bolded sentence, not a lead-in. */
const MAX_LABEL_LENGTH = 60;

/**
 * `**Insured.** We carry $200,000 …` → { label: 'Insured', body: 'We carry …' }.
 *
 * The terminating period *inside* the bold is required, and it is what separates the
 * two things authors write with the same syntax:
 *
 *   **Insured.** We carry $200,000 …        ← a label; a new sentence follows
 *   **Weather at KTEB** includes cold …     ← the subject of one continuing sentence
 *
 * Only the first is a point. Promoting the second to a heading strips the sentence of
 * its subject and leaves the body opening on a bare verb ("includes cold winters…"),
 * which is exactly how it read before this check existed. The punctuation is the
 * author's signal, so a payload opts in by writing the lead-in convention.
 *
 * Also rejects anything merely emphatic: a wholly bold paragraph with no body after
 * it, and a bold clause too long to be a label.
 */
function asPoint(block: string): ProsePoint | null {
  const match = block.match(/^\*\*([^*\n]+[.:])\*\*\s*([\s\S]*)$/);
  if (!match) return null;

  const label = match[1].trim().replace(/[.:]$/, '').trim();
  const body = match[2].trim();
  if (!label || !body || label.length > MAX_LABEL_LENGTH) return null;

  return { label, body };
}

/** Parses an authored body into the blocks a renderer can lay out. */
export function proseBlocks(body: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  /** Consecutive lead-in paragraphs, held back until we know how many there are. */
  let run: { point: ProsePoint; source: string }[] = [];

  const flushRun = () => {
    // One lead-in is an emphatic paragraph; two or more in a row is a list. A lone
    // one goes back out as its original text so nothing is silently restructured.
    if (run.length >= 2) {
      blocks.push({ kind: 'points', items: run.map((r) => r.point) });
    } else {
      for (const r of run) blocks.push({ kind: 'text', text: r.source });
    }
    run = [];
  };

  for (const block of paragraphs(body)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length > 0 && lines.every((l) => l.startsWith('- '))) {
      flushRun();
      blocks.push({ kind: 'list', items: lines.map((l) => l.slice(2).trim()) });
      continue;
    }

    const point = asPoint(block);
    if (point) {
      run.push({ point, source: block });
      continue;
    }

    flushRun();
    blocks.push({ kind: 'text', text: block });
  }

  flushRun();
  return blocks;
}
