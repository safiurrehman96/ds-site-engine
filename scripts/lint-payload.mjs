/**
 * Payload lint — source-level checks on one client's content and config.
 *
 *   pnpm lint <slug>        lint clients/<slug>/
 *   pnpm lint --all         lint every client
 *
 * Complements, not repeats, the other gates: zod (content.config.ts) validates
 * shape at build; verify-dist checks the built site. This runs in a second with no
 * build and reports by source file — the authoring-time aid. Two severities:
 *
 *   errors    — will ship wrong (fact drift, dead asset path, missing alt).
 *               Exit 1.
 *   warnings  — probably wrong, human judgement call (thin metaDescription,
 *               near-duplicate copy). Reported, exit 0.
 *
 * THE DRIFT CHECK
 * intake.json is the honest record of client facts; site.config.ts is what the
 * site displays. Nothing else compares them — a phone number corrected in intake
 * but not config ships wrong on every page and passes every other gate. Rule:
 * a fact that is null in intake is *pending* (check-intake's job, skipped here);
 * a fact present in both files must agree exactly.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const slugArg = args.find((a) => !a.startsWith('-'));

if (!ALL && !slugArg) {
  console.error('Usage: pnpm lint <slug>  |  pnpm lint --all');
  process.exit(1);
}

/* ------------------------------------------------------------------ helpers */

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`  ✗ ${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`  ⚠ ${file}: ${msg}`);

function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { data: parseYaml(m[1]), body: m[2] };
}

async function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await mdFiles(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const normalise = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/* -------------------------------------------------- drift: intake ↔ config */

/** intake path → config path, for every fact both files claim. */
const DRIFT_MAP = [
  ['business.name', 'brand.name'],
  ['business.tagline', 'brand.tagline'],
  ['business.blurb', 'brand.blurb'],
  ['business.footerNote', 'brand.footerNote'],
  ['business.websiteUrl', 'site.url'],
  ['business.category', 'seo.category'],
  ['business.region', 'seo.region'],
  ['contact.phone', 'contact.phone'],
  ['contact.phoneDisplay', 'contact.phoneDisplay'],
  ['contact.email', 'contact.email'],
  ['contact.address', 'contact.address'],
  ['serviceArea.baseCity', 'serviceArea.baseCity'],
  ['serviceArea.baseState', 'serviceArea.baseState'],
  ['serviceArea.radiusMiles', 'serviceArea.radiusMiles'],
  ['serviceArea.label', 'serviceArea.label'],
  ['hours', 'hours'],
  ['ghl.bookingUrls', 'ghl.bookingUrls'],
  ['ghl.quoteUrl', 'ghl.quoteUrl'],
  ['tracking.gtmId', 'tracking.gtmId'],
  ['theme.preset', 'theme.preset'],
  ['theme.accentColor', 'theme.accentColor'],
  ['modules.blogUrl', 'modules.blogUrl'],
  ['legal.effectiveDate', 'legal.effectiveDate'],
  ['legal.source', 'legal.source'],
];

const get = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj);

/**
 * Does config agree with intake everywhere intake actually states a fact?
 * null/undefined in intake means *pending* at any depth — a placeholder bookingUrl
 * whose intake url is null is the sanctioned pattern (DS_STRICT owns placeholders),
 * but its label, and every sibling fact, must still match.
 */
function agrees(truth, shown) {
  if (truth === null || truth === undefined) return true;
  if (Array.isArray(truth)) {
    return (
      Array.isArray(shown) &&
      truth.length === shown.length &&
      truth.every((v, i) => agrees(v, shown[i]))
    );
  }
  if (typeof truth === 'object') {
    return (
      typeof shown === 'object' &&
      shown !== null &&
      Object.entries(truth).every(([k, v]) => agrees(v, shown[k]))
    );
  }
  return truth === shown;
}

function checkDrift(slug, intake, config) {
  const file = `clients/${slug}/site.config.ts`;

  for (const [intakePath, configPath] of DRIFT_MAP) {
    const truth = get(intake, intakePath);
    if (truth === null || truth === undefined) continue; // pending — check-intake's job
    const shown = get(config, configPath);
    if (!agrees(truth, shown)) {
      err(
        file,
        `${configPath} disagrees with intake.json ${intakePath}:\n` +
          `      intake: ${JSON.stringify(truth)}\n` +
          `      config: ${JSON.stringify(shown)}`,
      );
    }
  }

  // socials: intake uses null for "none"; config omits the key. Compare non-null only.
  for (const [key, truth] of Object.entries(intake.socials ?? {})) {
    if (key === 'reviewUrl' || truth === null) continue;
    const shown = config.socials?.[key];
    if (truth !== shown) {
      err(file, `socials.${key} disagrees with intake.json: ${JSON.stringify(truth)} vs ${JSON.stringify(shown)}`);
    }
  }
}

/* ------------------------------------------------------------ content lint */

const META_MIN = 70; // below this a metaDescription wastes the SERP slot
const SHORT_DESC_RANGE = [40, 320];

function checkMeta(file, data, seen) {
  const meta = data.metaDescription;
  if (typeof meta !== 'string') return; // shape is zod's job
  if (meta.length < META_MIN) {
    warn(file, `metaDescription is ${meta.length} chars — thin for a SERP snippet (aim ${META_MIN}–160)`);
  }
  const owner = seen.get(normalise(meta));
  if (owner) err(file, `metaDescription duplicates ${owner}`);
  else seen.set(normalise(meta), file);
}

function checkAlts(file, data, brandName) {
  const walk = (node, trail) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${trail}[${i}]`));
    if (node && typeof node === 'object') {
      if (typeof node.src === 'string' && 'alt' in node) {
        const alt = node.alt ?? '';
        if (alt.trim().length < 12) {
          warn(file, `${trail}.alt is "${alt}" — too thin to describe the image (spec: "{subject} — ${brandName} in {City}, {ST}" where sensible)`);
        }
      }
      for (const [k, v] of Object.entries(node)) walk(v, trail ? `${trail}.${k}` : k);
    }
  };
  walk(data, '');
}

function checkBlogPost(file, data, body, clientDir) {
  // Body images: path resolves on disk, alt text present.
  for (const m of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
    const [, alt, src] = m;
    if (!alt.trim()) err(file, `body image ${src} has no alt text`);
    if (!/^(https?:)?\/\//.test(src)) {
      const resolved = path.resolve(path.dirname(file), src);
      if (!existsSync(resolved)) {
        err(file, `body image ${src} does not resolve (expected ${path.relative(clientDir, resolved)} in the payload)`);
      }
    }
  }
  // A future-dated post that is not a draft silently ships early.
  const date = new Date(data.publishDate);
  if (!Number.isNaN(date.getTime()) && date > new Date() && !data.draft) {
    err(file, `publishDate ${data.publishDate} is in the future but the post is not draft: true`);
  }
  if (body.includes('{{')) err(file, 'unresolved merge field in post body');
}

/* ------------------------------------------------------------------- runner */

async function lintClient(slug) {
  const clientDir = path.join('clients', slug);
  const before = errors.length + warnings.length;

  // Config + intake, for drift. Either missing → report and move on.
  const intakeFile = path.join(clientDir, 'source', 'intake.json');
  const configFile = path.join(clientDir, 'site.config.ts');
  if (existsSync(intakeFile) && existsSync(configFile)) {
    const intake = JSON.parse(await readFile(intakeFile, 'utf8'));
    const { siteConfig } = await import(path.resolve(configFile));
    checkDrift(slug, intake, siteConfig);
  } else {
    warn(clientDir, `drift check skipped — missing ${existsSync(intakeFile) ? 'site.config.ts' : 'source/intake.json'}`);
  }

  const brandName = '{Brand}';
  const seenMeta = new Map();
  for (const file of await mdFiles(path.join(clientDir, 'content'))) {
    const raw = await readFile(file, 'utf8');
    const parsed = frontmatter(raw);
    if (!parsed) {
      err(file, 'no frontmatter block');
      continue;
    }
    const { data, body } = parsed;

    checkMeta(file, data, seenMeta);
    checkAlts(file, data, brandName);

    if (typeof data.shortDescription === 'string') {
      const len = data.shortDescription.length;
      if (len < SHORT_DESC_RANGE[0] || len > SHORT_DESC_RANGE[1]) {
        warn(file, `shortDescription is ${len} chars — outside the ${SHORT_DESC_RANGE.join('–')} window grids are designed for`);
      }
    }

    if (file.includes(`${path.sep}blog${path.sep}`)) {
      checkBlogPost(file, data, body, clientDir);
    } else if (body.trim()) {
      // Every non-blog collection keeps prose in frontmatter; a non-empty body is
      // authored content the build will silently ignore.
      err(file, 'non-empty markdown body — this collection reads frontmatter only, the body will not render');
    }
  }

  return errors.length + warnings.length - before;
}

const slugs = ALL
  ? (await readdir('clients', { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
  : [slugArg];

for (const slug of slugs) {
  if (!existsSync(path.join('clients', slug))) {
    console.error(`No such client: clients/${slug}`);
    process.exit(1);
  }
  const findings = await lintClient(slug);
  console.log(`${slug}: ${findings === 0 ? 'clean' : `${findings} finding(s)`}`);
}

if (errors.length) console.error(`\nerrors (must fix):\n${errors.join('\n')}`);
if (warnings.length) console.log(`\nwarnings (judgement calls):\n${warnings.join('\n')}`);
process.exit(errors.length ? 1 : 0);
