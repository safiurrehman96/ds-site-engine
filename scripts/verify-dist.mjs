/**
 * Post-build verification of dist/ — the checks zod cannot make, because they are
 * properties of the *built site*, not of any one source file.
 *
 *   node scripts/verify-dist.mjs        (runs automatically via postbuild)
 *
 *   1. internal links   every href/src starting with "/" resolves to a built file
 *   2. duplicate meta   no two indexable pages share a <title> or meta description
 *   3. image alt        no <img> ships without an alt attribute (empty alt="" is
 *                       allowed — that is the correct markup for decorative images;
 *                       *missing* alt is never correct)
 *   4. merge fields     no "{{" survives into rendered text — backstop to the
 *                       source-level checks in content.config.ts
 *   5. sitemap          indexable pages and sitemap entries agree, both directions
 *
 * Every finding is reported by page and name, engine-style. Any finding fails the
 * process, which fails the build.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';

/** Pages that are built but deliberately not part of the public site's graph. */
const NEVER_INDEXED = new Set(['404.html']);

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** dist/about/index.html → /about/ ; dist/404.html → /404.html */
function urlPath(file) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** Does an internal URL path resolve to something the build produced? */
function resolves(url) {
  const clean = url.split(/[?#]/)[0];
  const rel = decodeURIComponent(clean).replace(/^\//, '');
  const asFile = path.join(DIST, rel);
  return (
    existsSync(asFile) ||
    existsSync(path.join(asFile, 'index.html')) ||
    // Astro dev-style route without trailing slash: /about → /about/index.html
    existsSync(`${asFile}.html`)
  );
}

function stripScriptsAndStyles(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

const problems = [];
const report = (page, message) => problems.push(`  · ${page}: ${message}`);

const files = await htmlFiles(DIST).catch(() => null);
if (!files) {
  console.error(`verify-dist: no ${DIST}/ directory — run a build first.`);
  process.exit(1);
}

const pages = [];
for (const file of files) {
  const html = await readFile(file, 'utf8');
  pages.push({ file, url: urlPath(file), html });
}

/* ---- 1. internal links + srcs ---------------------------------------- */

for (const { url, html } of pages) {
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) refs.add(m[1]);
  // srcset entries: "url width," pairs
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith('/')) refs.add(u);
    }
  }
  for (const ref of refs) {
    if (ref.startsWith('//')) continue; // protocol-relative external
    if (!resolves(ref)) report(url, `dead internal link ${ref}`);
  }
}

/* ---- 2 + 5 need indexability ------------------------------------------ */

const indexable = pages.filter(
  ({ file, html }) =>
    !NEVER_INDEXED.has(path.relative(DIST, file)) &&
    !/<meta[^>]+name="robots"[^>]+noindex/i.test(html),
);

/* ---- 2. duplicate titles / descriptions ------------------------------- */

for (const [label, pattern] of [
  ['title', /<title>([^<]*)<\/title>/i],
  ['meta description', /<meta[^>]+name="description"[^>]+content="([^"]*)"/i],
]) {
  const seen = new Map();
  for (const { url, html } of indexable) {
    const value = html.match(pattern)?.[1].trim();
    if (!value) {
      report(url, `missing ${label}`);
      continue;
    }
    const owner = seen.get(value);
    if (owner) report(url, `duplicate ${label} (also on ${owner}): "${value.slice(0, 60)}…"`);
    else seen.set(value, url);
  }
}

/* ---- 3. images without alt -------------------------------------------- */

for (const { url, html } of pages) {
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    // A valueless `alt` is how Astro serializes alt="" — decorative, and allowed.
    if (!/\salt(?:=|[\s/>])/.test(m[0])) {
      const src = m[0].match(/\bsrc="([^"]*)"/)?.[1] ?? '(unknown src)';
      report(url, `<img> without alt attribute: ${src}`);
    }
  }
}

/* ---- 4. merge-field sweep ---------------------------------------------- */

for (const { url, html } of pages) {
  const text = stripScriptsAndStyles(html);
  const m = text.match(/\{\{[^}]*\}?\}?/);
  if (m) report(url, `unresolved merge field in rendered output: "${m[0].slice(0, 40)}"`);
}

/* ---- 5. sitemap agreement ---------------------------------------------- */

const sitemapFile = path.join(DIST, 'sitemap-0.xml');
if (!existsSync(sitemapFile)) {
  report('/sitemap-0.xml', 'sitemap missing from build output');
} else {
  const xml = await readFile(sitemapFile, 'utf8');
  const listed = new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname),
  );
  const built = new Set(indexable.map((p) => p.url));

  for (const url of built) {
    if (!listed.has(url)) report(url, 'indexable page missing from sitemap');
  }
  for (const url of listed) {
    if (!built.has(url)) report(url, 'sitemap lists a page that is missing or noindexed');
  }
}

/* ---- verdict ------------------------------------------------------------ */

if (problems.length) {
  console.error(`verify-dist: ${problems.length} problem(s) in ${DIST}/:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`verify-dist: ${pages.length} pages checked (${indexable.length} indexable) — clean.`);
