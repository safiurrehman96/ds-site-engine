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
 * Two providers, selected per manifest (`defaults.provider`) or with --provider=:
 *
 *   kie     — api.kie.ai, async: createTask → poll recordInfo → download. Cheaper, and
 *             reports creditsConsumed per image so a run's cost is knowable. Needs
 *             KIE_API_KEY.
 *   openai  — api.openai.com, synchronous, returns base64 inline. Needs OPENAI_API_KEY.
 *
 * Both take the same manifest. Prompts and framing are provider-independent, so
 * switching is a one-word change and does not invalidate reviewed prompts.
 *
 * Keys are read from the environment or a gitignored .env at the repo root. Images are
 * written straight to WebP at the client's asset budget.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
async function loadApiKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const text = await readFile('.env', 'utf8');
    const line = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).replace(/^["']|["']$/g, '').trim();
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries transport failures and 429/5xx only. A 4xx is a bad request — wrong model id,
 * rejected prompt, dead key — and retrying spends money without changing the outcome,
 * so the API's own message is surfaced verbatim instead.
 */
async function requestWithRetry(url, options, { attempts = 4 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (attempt === attempts) throw error;
      await sleep(2 ** attempt * 1000);
      continue;
    }

    if (response.ok) return response;

    const detail = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts) {
      throw new Error(`HTTP ${response.status} — ${detail.slice(0, 600)}`);
    }
    console.warn(`  … HTTP ${response.status}, retrying in ${2 ** attempt}s`);
    await sleep(2 ** attempt * 1000);
  }
  throw new Error('unreachable');
}

/** OpenAI sizes, keyed by the manifest's provider-independent aspect ratio. */
const OPENAI_SIZES = { '3:2': '1536x1024', '2:3': '1024x1536', '1:1': '1024x1024' };

const PROVIDERS = {
  openai: {
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-image-2',
    async generate({ prompt, model, aspectRatio, quality, size, apiKey }) {
      const resolved = size ?? OPENAI_SIZES[aspectRatio];
      if (!resolved) {
        throw new Error(
          `aspect ratio "${aspectRatio}" has no OpenAI size mapping — set an explicit "size".`,
        );
      }
      const body = { model, prompt, size: resolved, n: 1 };
      if (quality) body.quality = quality;

      const response = await requestWithRetry('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });

      const json = await response.json();
      const item = json.data?.[0];
      if (item?.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64') };
      if (item?.url) return { buffer: Buffer.from(await (await fetch(item.url)).arrayBuffer()) };
      throw new Error('API returned no image data.');
    },
  },

  /**
   * Kie is task-based: createTask returns a taskId, and the image only exists once
   * recordInfo reports state "success". Its HTTP 200 carries an application-level
   * `code`, so a transport-level ok response can still be a failure.
   */
  kie: {
    envKey: 'KIE_API_KEY',
    defaultModel: 'gpt-image-2-text-to-image',

    /**
     * Task-level retry. A Kie task can accept cleanly over HTTP and then come back
     * state:"fail" with an infrastructure failCode (500, 501) — transient, and distinct
     * from the transport errors requestWithRetry handles. Without this, one blip loses
     * an image in the middle of a long batch. A 4xx failCode is the prompt or the
     * request being rejected, so it is not retried.
     */
    async generate(options) {
      const ATTEMPTS = 3;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
        try {
          return await PROVIDERS.kie.runTask(options);
        } catch (error) {
          const transient = /generation failed — 5\d\d|timed out/.test(error.message);
          if (!transient || attempt === ATTEMPTS) throw error;
          console.warn(`  … ${error.message} — retrying (${attempt}/${ATTEMPTS - 1})`);
          await sleep(3000 * attempt);
        }
      }
      throw new Error('unreachable');
    },

    async runTask({ prompt, model, aspectRatio, resolution, apiKey }) {
      const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };

      const created = await requestWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          model,
          input: { prompt, aspect_ratio: aspectRatio, resolution },
        }),
      });

      const createdJson = await created.json();
      if (createdJson.code !== 200 || !createdJson.data?.taskId) {
        throw new Error(`createTask failed — code ${createdJson.code}: ${createdJson.msg}`);
      }
      const { taskId } = createdJson.data;

      const POLL_MS = 3000;
      const TIMEOUT_MS = 6 * 60 * 1000;
      const deadline = Date.now() + TIMEOUT_MS;

      while (Date.now() < deadline) {
        await sleep(POLL_MS);
        const polled = await requestWithRetry(
          `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
          { headers: auth },
        );
        const { code, msg, data } = await polled.json();
        if (code !== 200) throw new Error(`recordInfo failed — code ${code}: ${msg}`);

        if (data.state === 'fail') {
          throw new Error(`generation failed — ${data.failCode}: ${data.failMsg}`);
        }
        if (data.state !== 'success') continue;

        // resultJson is a JSON *string*, not an object.
        const result = JSON.parse(data.resultJson ?? '{}');
        const url = result.resultUrls?.[0];
        if (!url) throw new Error('task succeeded but returned no result URL.');

        const file = await requestWithRetry(url, {});
        return {
          buffer: Buffer.from(await file.arrayBuffer()),
          credits: data.creditsConsumed,
        };
      }

      throw new Error(`timed out after ${TIMEOUT_MS / 1000}s waiting on task ${taskId}.`);
    },
  },
};

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

const providerName = valueOf('--provider', defaults.provider ?? 'kie');
const provider = PROVIDERS[providerName];
if (!provider) {
  console.error(
    `Unknown provider "${providerName}". Available: ${Object.keys(PROVIDERS).join(', ')}.`,
  );
  process.exit(1);
}
const model = valueOf('--model', defaults.model?.[providerName] ?? provider.defaultModel);
const aspectRatio = valueOf('--aspect', defaults.aspectRatio ?? '3:2');
const resolution = valueOf('--resolution', defaults.resolution ?? '2K');

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
    console.log(`\n── ${image.id} → ${image.out} (${image.aspectRatio ?? aspectRatio})`);
    console.log(fullPrompt(image, manifest));
  }
  console.log(
    `\nDry run — ${queue.length} image(s) would be generated via ${providerName} "${model}".`,
  );
  process.exit(0);
}

const apiKey = await loadApiKey(provider.envKey);
if (!apiKey) {
  console.error(
    `${provider.envKey} is not set (provider: ${providerName}).\n` +
      'Export it, or add a line to a .env file at the repo root (.env is gitignored):\n' +
      `  ${provider.envKey}=...`,
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
      const { buffer, credits } = await provider.generate({
        prompt: fullPrompt(image, manifest),
        model,
        aspectRatio: image.aspectRatio ?? aspectRatio,
        resolution: image.resolution ?? resolution,
        quality: image.quality ?? defaults.quality,
        size: image.size,
        apiKey,
      });
      const info = await toWebp(
        buffer,
        path.join(ASSET_DIR, image.out),
        image.resizeWidth ?? defaults.resizeWidth ?? 1400,
      );
      console.log(
        `${label} — ${image.out} ${info.width}x${info.height} ` +
          `${Math.round(info.size / 1024)}kB (q${info.quality})` +
          (credits == null ? '' : ` · ${credits} credits`),
      );
      results.push({ image, ok: true, credits });
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
  const credits = ok.reduce((sum, r) => sum + (r.credits ?? 0), 0);
  // Credit→USD is account-specific and not exposed by the API. Set KIE_CREDIT_USD to
  // the rate on your billing page and the run reports money instead of credits.
  const rate = Number(process.env.KIE_CREDIT_USD ?? (await loadApiKey('KIE_CREDIT_USD')) ?? 0);
  const cost = rate > 0 ? ` ≈ $${(credits * rate).toFixed(3)}` : '';
  console.log(
    `\nGenerated ${ok.length} image(s)` +
      (credits > 0 ? ` for ${credits} credits${cost}` : '') +
      '. Repoint the payload:',
  );
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
