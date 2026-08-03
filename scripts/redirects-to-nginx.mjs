/**
 * Translates a Netlify/Cloudflare `_redirects` file into nginx rules.
 *
 *   node scripts/redirects-to-nginx.mjs clients/example/_redirects out.conf
 *
 * nginx serves dist/ directly and ignores `_redirects`, so without this step a
 * migration 301 silently does nothing (see README "Also before the first deploy").
 * The output is a snippet of `location` blocks meant for `include` inside the
 * server block, written even when there are no rules so the Dockerfile COPY
 * never has a missing file.
 *
 * Supported: `<from> <to> <status>` with an optional trailing `/*` splat on both
 * sides. Anything fancier (query matching, placeholders, country codes) is not
 * used by any client and fails loudly rather than mistranslating.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: redirects-to-nginx.mjs <_redirects> <out.conf>');
  process.exit(1);
}

const lines = existsSync(src) ? (await readFile(src, 'utf8')).split('\n') : [];
const rules = [];

for (const [i, raw] of lines.entries()) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;

  const parts = line.split(/\s+/);
  const [from, to, status = '301'] = parts;
  if (parts.length < 2 || parts.length > 3 || !from.startsWith('/') || !/^30[1278]$/.test(status)) {
    console.error(`✗ ${src}:${i + 1} unsupported redirect syntax: "${line}"`);
    process.exit(1);
  }
  if (/[:*]/.test(from.replace(/\/\*$/, '')) || /[:*]/.test(to.replace(/:splat$/, ''))) {
    console.error(`✗ ${src}:${i + 1} placeholders beyond a trailing splat are unsupported: "${line}"`);
    process.exit(1);
  }

  if (from.endsWith('/*')) {
    const base = from.slice(0, -2);
    const target = to.endsWith(':splat') ? `${to.slice(0, -6)}$1` : to;
    rules.push(`location ~ ^${escapeRegex(base)}/(.*)$ { return ${status} ${target}; }`);
  } else {
    rules.push(`location = ${from} { return ${status} ${to}; }`);
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const header = `# Generated from ${src} by scripts/redirects-to-nginx.mjs — do not edit.\n`;
await writeFile(out, header + rules.join('\n') + '\n');
console.log(`✓ ${rules.length} redirect(s) → ${out}`);
