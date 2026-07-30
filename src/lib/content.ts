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
  'booking',
  'booking-confirmed',
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

/**
 * Compact label — no state, for surfaces that are already spatially constrained
 * (grid tiles). Distinct from areaLabel: a tile has never shown the state.
 */
export function areaShortLabel(area: { name: string; shortName?: string }): string {
  return area.shortName ?? area.name;
}

/** Singleton pages. Throw loudly rather than rendering an empty page. */
async function getSingleton<C extends 'home' | 'about' | 'faqs' | 'booking' | 'getQuote' | 'bookingConfirmed'>(
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
export const getBooking = () => getSingleton('booking', 'booking');
export const getGetQuote = () => getSingleton('getQuote', 'get-quote');
export const getBookingConfirmed = () => getSingleton('bookingConfirmed', 'booking-confirmed');

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
