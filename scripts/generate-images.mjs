/**
 * Generates payload photography from a per-client prompt manifest.
 *
 *   pnpm run images jetspa                      # everything still missing
 *   pnpm run images jetspa --only brightwork-hero,deice-hero
 *   pnpm run images jetspa --dry-run            # cost + plan, no API calls
 *   pnpm run images jetspa --force              # re-generate even if the file exists
 *
 * Why a manifest rather than ad-hoc prompts: a site payload has 60+ image slots, and
 * the same shot gets regenerated across a client's life (a rebrand, a better crop, a
 * new service). Prompts that live only in a chat window cannot be reviewed, diffed, or
 * re-run. clients/<slug>/image-prompts.json is the source of truth; this script is
 * just the executor.
 *
 * Skips any output that already exists, so it is safe to re-run after adding a slot —
 * only the new entries cost money.
 *
 * It deliberately does NOT edit content markdown. Repointing a payload is a review
 * step: a wrong `src` silently ships the wrong picture, and the diff is where that
 * gets caught. The run report prints exactly what to change.
 *
 * Requires OPENAI_API_KEY (read from the environment or a gitignored .env at the repo
 * root). Images are written straight to WebP at the client's asset budget.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const API_URL = 'https://api.openai.com/v1/images/generations';

/** Mirrors BUDGETS_KB in src/integrations/asset-budget.ts — the build fails above this. */
const BUDGET_KB = 600;
const QUALITY_LADDER = [82, 74, 66, 58];

const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith('-'));
const has = (flag) => argv.includes(flag);
const valueOf = (flag, fallback) => {
  const hit = argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
};

if (!slug) {
  console.error(
    'Usage: pnpm run images <slug> [--only=id,id] [--force] [--dry-run] [--model=<id>] [--concurrency=N]',
  );
  process.exit(1);
}

const FORCE = has('--force');
const DRY_RUN = has('--dry-run');
const ONLY = valueOf('--only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CONCURRENCY = Math.max(1, Number(valueOf('--concurrency', '3')) || 3);

const CLIENT_DIR = path.join('clients', slug);
const ASSET_DIR = path.join(CLIENT_DIR, 'assets');
const MANIFEST = path.join(CLIENT_DIR, 'image-prompts.json');

/** Minimal .env reader: this runs before any framework, and dotenv is not a dependency. */
async function loadApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const text = await readFile('.env', 'utf8');
    const line = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('OPENAI_API_KEY='));
    if (line) return line.slice('OPENAI_API_KEY='.length).replace(/^["']|["']$/g, '').trim();
  } catch {
    /* no .env — fall through to the error below */
  }
  return null;
}

async function loadManifest() {
  let raw;
  try {
    raw = await readFile(MANIFEST, 'utf8');
  } catch {
    console.error(
      `No prompt manifest at ${MANIFEST}.\n` +
        `Create one with { "style": "...", "defaults": {...}, "images": [...] }.`,
    );
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    console.error(`${MANIFEST} is not valid JSON: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
    console.error(`${MANIFEST} has no "images" array.`);
    process.exit(1);
  }

  const seen = new Set();
  for (const image of manifest.images) {
    for (const field of ['id', 'out', 'prompt']) {
      if (!image[field]) {
        console.error(`Manifest entry ${image.id ?? '(unnamed)'} is missing "${field}".`);
        process.exit(1);
      }
    }
    if (seen.has(image.id)) {
      console.error(`Duplicate manifest id "${image.id}".`);
      process.exit(1);
    }
    seen.add(image.id);
    if (!image.out.endsWith('.webp')) {
      console.error(`Manifest entry "${image.id}" must write a .webp file (got "${image.out}").`);
      process.exit(1);
    }
  }

  return manifest;
}

/**
 * The style block is appended rather than prepended: image models weight the opening of
 * a prompt most heavily, and the subject should win that position over the grade.
 */
function fullPrompt(image, manifest) {
  return manifest.style ? `${image.prompt.trim()}\n\n${manifest.style.trim()}` : image.prompt.trim();
}

async function generate({ prompt, model, size, quality, apiKey }) {
  const body = { model, prompt, size, n: 1 };
  if (quality) body.quality = quality;

  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const json = await response.json();
      const item = json.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
      if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
      throw new Error('API returned no image data.');
    }

    const detail = await response.text();

    // 4xx other than rate-limiting is a bad request — a wrong model id, a rejected
    // prompt, a dead key. Retrying spends money without changing the outcome, so the
    // API's own message is surfaced verbatim instead.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`HTTP ${response.status} — ${detail.slice(0, 600)}`);
    }

    const wait = 2 ** attempt * 1000;
    console.warn(`  … HTTP ${response.status}, retrying in ${wait / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  throw new Error('unreachable');
}

/**
 * Steps the WebP quality down until the file clears the asset budget. A generated image
 * that overshoots would otherwise fail the build later, far from the cause.
 */
async function toWebp(buffer, outPath, resizeWidth) {
  let last;
  for (const quality of QUALITY_LADDER) {
    const encoded = await sharp(buffer)
      .resize({ width: resizeWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });
    last = { ...encoded, quality };
    if (encoded.info.size / 1024 <= BUDGET_KB) break;
  }
  await writeFile(outPath, last.data);
  return { ...last.info, quality: last.quality };
}

const manifest = await loadManifest();
const defaults = manifest.defaults ?? {};
const model = valueOf('--model', defaults.model ?? 'gpt-image-1');

const queue = manifest.images.filter((image) => {
  if (ONLY.length && !ONLY.includes(image.id)) return false;
  if (!FORCE && existsSync(path.join(ASSET_DIR, image.out))) return false;
  return true;
});

console.log(`${manifest.images.length} slot(s) in manifest · ${queue.length} to generate.`);
const skipped = manifest.images.length - queue.length;
if (!FORCE && !ONLY.length && skipped > 0) {
  console.log(`${skipped} already present (use --force to replace).`);
}
if (queue.length === 0) process.exit(0);

if (DRY_RUN) {
  for (const image of queue) {
    console.log(`\n── ${image.id} → ${image.out} (${image.size ?? defaults.size ?? '1536x1024'})`);
    console.log(fullPrompt(image, manifest));
  }
  console.log(`\nDry run — ${queue.length} image(s) would be generated with model "${model}".`);
  process.exit(0);
}

const apiKey = await loadApiKey();
if (!apiKey) {
  console.error(
    'OPENAI_API_KEY is not set.\n' +
      'Export it, or add a line to a .env file at the repo root (.env is gitignored):\n' +
      '  OPENAI_API_KEY=sk-...',
  );
  process.exit(1);
}

await mkdir(ASSET_DIR, { recursive: true });

const results = [];
let cursor = 0;

async function worker() {
  while (cursor < queue.length) {
    const image = queue[cursor];
    cursor += 1;
    const label = `[${cursor}/${queue.length}] ${image.id}`;
    try {
      console.log(`${label} — generating…`);
      const raw = await generate({
        prompt: fullPrompt(image, manifest),
        model,
        size: image.size ?? defaults.size ?? '1536x1024',
        quality: image.quality ?? defaults.quality,
        apiKey,
      });
      const info = await toWebp(
        raw,
        path.join(ASSET_DIR, image.out),
        image.resizeWidth ?? defaults.resizeWidth ?? 1400,
      );
      console.log(
        `${label} — ${image.out} ${info.width}x${info.height} ` +
          `${Math.round(info.size / 1024)}kB (q${info.quality})`,
      );
      results.push({ image, ok: true });
    } catch (error) {
      console.error(`${label} — FAILED: ${error.message}`);
      results.push({ image, ok: false, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

const ok = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

if (ok.length) {
  console.log(`\nGenerated ${ok.length} image(s). Repoint the payload:`);
  for (const { image } of ok) {
    for (const target of image.usedBy ?? []) {
      console.log(`  · ${target}`);
    }
    console.log(`      src: "./assets/${image.out}"`);
    if (image.alt) console.log(`      alt: "${image.alt}"`);
  }
}

if (failed.length) {
  console.error(`\n${failed.length} image(s) failed.`);
  process.exit(1);
}
