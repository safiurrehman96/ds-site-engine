/**
 * Notion export → payload intermediate.
 *
 *   pnpm run import jetspa                dry run against clients/jetspa/source/
 *   pnpm run import jetspa -- --write     write the intermediate to .import/
 *   pnpm run import -- --in <dir>         ad-hoc run against any export directory
 *
 * WHAT THIS DOES
 * Only the deterministic half of an import: parse the Notion property block, resolve
 * every {{custom_values.*}} merge field, rewrite Notion's absolute links back to site
 * paths, and report what is left over. Output is one JSON file per page.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * Map prose sections onto the `packages`, `addons`, and `processSteps` arrays in
 * src/content.config.ts. That mapping is a judgement call per client — "What Is
 * Included" is a package list on one page and a single paragraph on the next — and a
 * heuristic that guesses wrong fails silently, producing a page that builds and reads
 * like nonsense. The intermediate is reviewed, then the collection files are authored
 * from it.
 *
 * CLIENT FACTS
 * Merge fields resolve from the client's intake file — clients/<slug>/source/intake.json,
 * the same file `pnpm run intake` validates and that site.config.ts is written from. One
 * source of truth: a fact corrected there is corrected everywhere.
 *
 * A fact that is still null resolves nothing. The token is left intact and reported,
 * rather than filled with something plausible — an invented value reads as real and
 * survives review, while an unresolved one fails the build (src/content.config.ts
 * rejects any `{{` in prose).
 */
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { intakeSchema, tokenMaps } from './intake-schema.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

/** A bare argument is a client slug: everything else is derived from it. */
const SLUG = args.find((a) => !a.startsWith('-') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);

const IN = flag('in', SLUG ? path.join('clients', SLUG, 'source') : null);
const OUT = flag('out', '.import');
const INTAKE = flag('intake', SLUG ? path.join('clients', SLUG, 'source', 'intake.json') : null);
// Dry run is the default: this reads a client's content and should not scatter files
// on a first, exploratory run.
const DRY = args.includes('--dry-run') || !args.includes('--write');

const PAGES_DIR = IN ? path.join(IN, 'Website Pages') : null;

/** Notion exports suffix every filename with a 32-char page id. */
const NOTION_ID = /\s+[0-9a-f]{32}$/;

/* ------------------------------------------------------------------ client facts */

/**
 * The intake file, parsed through the same schema `pnpm run intake` uses — so a
 * malformed one is rejected here identically rather than half-applied.
 */
async function loadIntake() {
  if (!INTAKE || !existsSync(INTAKE)) {
    console.warn(
      `! No intake at ${INTAKE ?? '(none given)'} — every {{custom_values.*}} token will be\n` +
        `  reported unresolved. Run: pnpm run import <slug>`,
    );
    return null;
  }

  const parsed = intakeSchema.safeParse(JSON.parse(await readFile(INTAKE, 'utf8')));
  if (!parsed.success) {
    console.error(`✗ ${INTAKE} is invalid — run \`pnpm run intake ${SLUG ?? ''}\` for detail.`);
    process.exit(1);
  }
  return parsed.data;
}

/* ---------------------------------------------------------------------- parsing */

const TOKEN = /\{\{\s*custom_values\.([a-z_]+)\s*\}\}/g;

/** Notion wraps tokens in backticks, including inside link destinations. */
const unbacktick = (s) => s.replace(/`(\{\{[^}]*\}\})`/g, '$1');

function resolve(text, map, unresolved) {
  return text.replace(TOKEN, (whole, name) => {
    const value = map[name];
    if (value == null) {
      unresolved.add(name);
      return whole;
    }
    return value;
  });
}

/**
 * Rewrites the absolute URLs a Notion export writes for internal links back to site
 * paths. `known` is the set of slugs the export actually contains, so a link to a
 * page nobody wrote is reported rather than silently emitted as a 404.
 */
function rewriteLink(href, known, dangling) {
  const notion = href.match(/^https?:\/\/(?:www\.)?(?:app\.)?notion\.(?:so|com)\/(.+)$/);
  if (!notion) return href;

  const slug = notion[1].replace(/[?#].*$/, '').replace(/\/$/, '');
  const target = `/${slug}`;
  if (!known.has(target)) dangling.add(target);
  return target;
}

function parsePage(raw) {
  const lines = raw.split('\n');
  const title = (lines[0] ?? '').replace(/^#\s*/, '').trim();

  // Property block: "Key: value" lines between the title and the first blank line.
  const props = {};
  let i = 1;
  while (i < lines.length && !lines[i].trim()) i++;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;
    const m = line.match(/^([A-Za-z][A-Za-z0-9 :/]*?):\s*(.*)$/);
    if (!m) break;
    props[m[1].trim()] = m[2].trim();
  }

  // Body starts after the META OG line, which is engine-generated meta, not content.
  const rest = lines.slice(i).join('\n');
  const body = rest.replace(/^\s*META OG:[^\n]*\n/m, '').trim();

  // Sections: everything up to the first "## " is the intro under the H1.
  const sections = [];
  let current = { heading: null, level: 1, body: [] };
  for (const line of body.split('\n')) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h && h[1].length <= 3) {
      // "# X" here is the page H1, restated in the body by the generator.
      sections.push(current);
      current = { heading: h[2].trim(), level: h[1].length, body: [] };
      continue;
    }
    current.body.push(line);
  }
  sections.push(current);

  return {
    title,
    props,
    sections: sections
      .map((s) => ({ ...s, body: s.body.join('\n').trim() }))
      .filter((s) => s.heading || s.body),
  };
}

/** "#### Q" + following prose, as they appear under a FAQ section. */
function extractFaqs(sectionBody) {
  const faqs = [];
  let q = null;
  let a = [];
  for (const line of sectionBody.split('\n')) {
    const m = line.match(/^####\s+(.*)$/);
    if (m) {
      if (q) faqs.push({ q, a: a.join('\n').trim() });
      q = m[1].trim();
      a = [];
    } else if (q) {
      a.push(line);
    }
  }
  if (q) faqs.push({ q, a: a.join('\n').trim() });
  return faqs;
}

/* -------------------------------------------------------------------------- run */

async function main() {
  if (!PAGES_DIR || !existsSync(PAGES_DIR)) {
    console.error(`✗ No "Website Pages" directory under ${IN}/`);
    process.exit(1);
  }

  const intake = await loadIntake();
  // No intake: every token reports unresolved rather than silently vanishing.
  const maps = intake ? tokenMaps(intake) : { prose: {}, href: {} };

  const files = (await readdir(PAGES_DIR)).filter((f) => f.endsWith('.md')).sort();
  const raws = await Promise.all(
    files.map(async (f) => ({ file: f, raw: await readFile(path.join(PAGES_DIR, f), 'utf8') })),
  );

  // Two passes: the slug set has to exist before any link can be checked against it.
  const parsed = raws.map(({ file, raw }) => ({ file, ...parsePage(raw) }));
  const known = new Set(parsed.map((p) => p.props['URL Slug']).filter(Boolean));

  const pages = [];
  const report = { pages: files.length, unresolved: {}, dangling: {}, unmapped: [] };

  for (const p of parsed) {
    const unresolved = new Set();
    const dangling = new Set();

    const slug = p.props['URL Slug'] ?? `/${p.file.replace(/\.md$/, '').replace(NOTION_ID, '')}`;

    const clean = (text) => {
      let out = unbacktick(text);
      // Links first: destination and label resolve against different maps.
      out = out.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, label, href) => {
        const l = resolve(label, maps.prose, unresolved);
        const h = rewriteLink(resolve(href, maps.href, unresolved), known, dangling);
        return `[${l}](${h})`;
      });
      return resolve(out, maps.prose, unresolved);
    };

    const sections = p.sections.map((s) => {
      const body = clean(s.body);
      const isFaq = /frequently asked|faq/i.test(s.heading ?? '');
      return {
        heading: s.heading ? clean(s.heading) : null,
        level: s.level,
        body,
        ...(isFaq ? { faqs: extractFaqs(body) } : {}),
        // Flags a section the author still has to place by hand.
        placeholders: [...body.matchAll(/\[([A-Z][A-Z /]+)\]/g)].map((m) => m[1]),
      };
    });

    const page = {
      sourceFile: p.file,
      title: clean(p.title),
      slug,
      pageType: p.props['Page Type'] ?? null,
      order: p.props['Page Order'] ? Number(p.props['Page Order']) : null,
      status: p.props.Status ?? null,
      seo: {
        title: p.props['SEO Title'] ? clean(p.props['SEO Title']) : null,
        metaDescription: p.props['SEO Description'] ? clean(p.props['SEO Description']) : null,
        keywords: (p.props['SEO Keywords'] ?? '')
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      },
      internalLinks: (p.props['Internal Links'] ?? '')
        .split(',')
        .map((l) => clean(l.trim()))
        .filter(Boolean),
      sections,
    };

    if (unresolved.size) report.unresolved[slug] = [...unresolved];
    if (dangling.size) report.dangling[slug] = [...dangling];
    for (const s of sections) {
      for (const ph of s.placeholders) {
        report.unmapped.push({ slug, section: s.heading, placeholder: ph });
      }
    }

    pages.push(page);
  }

  /* ----------------------------------------------------------------- reporting */

  const byType = pages.reduce((acc, p) => {
    acc[p.pageType ?? 'unknown'] = (acc[p.pageType ?? 'unknown'] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\n${pages.length} pages parsed from ${PAGES_DIR}`);
  console.log(
    Object.entries(byType)
      .map(([t, n]) => `  ${t}: ${n}`)
      .join('\n'),
  );

  const unresolvedNames = new Set(Object.values(report.unresolved).flat());
  if (unresolvedNames.size) {
    console.log(`\n! unresolved merge fields (${unresolvedNames.size} distinct):`);
    for (const name of [...unresolvedNames].sort()) {
      const where = Object.entries(report.unresolved)
        .filter(([, names]) => names.includes(name))
        .map(([slug]) => slug);
      console.log(`  · {{custom_values.${name}}} — ${where.length} page(s), e.g. ${where[0]}`);
    }
    console.log('  These fail the build if authored into content (see src/content.config.ts).');
  } else {
    console.log('\n✓ every merge field resolved');
  }

  const danglingCount = Object.values(report.dangling).flat().length;
  if (danglingCount) {
    console.log(`\n! ${danglingCount} link(s) point at pages not in this export:`);
    for (const [slug, targets] of Object.entries(report.dangling)) {
      console.log(`  · ${slug} → ${targets.join(', ')}`);
    }
  } else {
    console.log('✓ every internal link resolves to a page in this export');
  }

  if (report.unmapped.length) {
    console.log(`\n! ${report.unmapped.length} placeholder(s) needing a component or an asset:`);
    for (const u of report.unmapped) {
      console.log(`  · ${u.slug} — [${u.placeholder}] under "${u.section}"`);
    }
  }

  /* -------------------------------------------------------------------- output */

  if (DRY) {
    console.log(`\n(dry run — nothing written. Re-run with --write to emit to ${OUT}/)`);
    return;
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const page of pages) {
    const name = page.slug === '/' ? 'index' : page.slug.replace(/^\//, '').replace(/\//g, '-');
    await writeFile(path.join(OUT, `${name}.json`), `${JSON.stringify(page, null, 2)}\n`);
  }
  await writeFile(path.join(OUT, '_report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n✓ wrote ${pages.length} page files + _report.json to ${OUT}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
