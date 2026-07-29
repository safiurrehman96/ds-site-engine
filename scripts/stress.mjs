/**
 * Preset stress test — Phase 4 task 3, and the basis of Phase 6's CI gate.
 *
 *   pnpm run stress            all presets
 *   pnpm run stress -- fresh   one preset
 *
 * For every preset it builds the site under `DS_PRESET`, then checks:
 *   · astro check           types clean (once, not per preset)
 *   · build                 succeeds, including contrast + asset-budget validation
 *   · internal links        every href/src in dist resolves
 *   · og:image              every page's og:image resolves to a real file
 *   · Lighthouse            perf / a11y / best-practices / SEO thresholds
 *   · colour contrast       the audit must pass outright, not just score well
 *   · responsive            no horizontal overflow at 360 / 768 / 1440
 *
 * Nothing here writes to `client/`. The preset is passed by environment variable,
 * so an interrupted run cannot leave the payload on the wrong preset — which is
 * exactly what the previous hand-run shell loop did, twice.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, rm, cp, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as fsSync from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const PRESETS = ['fresh', 'stealth', 'chrome', 'bold'];
const OUT = '.stress';
const PORT = 4405;

/**
 * Pages sampled per preset: home plus one service page exercise every component.
 *
 * The service slug is read from the active client's intake rather than hardcoded —
 * `/auto-detailing/` exists only on Kleen, and against any other payload the audit
 * scored a 404 as a page and reported four threshold failures that had nothing to do
 * with the site.
 */
function sampleRoutes() {
  const slug = process.env.DS_CLIENT ?? path.basename(fsSync.readlinkSync('client'));
  const intakePath = path.join('clients', slug, 'source', 'intake.json');
  try {
    const intake = JSON.parse(fsSync.readFileSync(intakePath, 'utf8'));
    const first = [...intake.pages.services].sort((a, b) => a.order - b.order)[0];
    return ['/', `/${first.slug}/`];
  } catch {
    throw new Error(
      `Cannot determine a service page to sample: no readable ${intakePath}.\n` +
        'Every client needs source/intake.json (see scripts/intake.template.json).',
    );
  }
}

const SAMPLE = sampleRoutes();

const THRESHOLDS = {
  performance: 90,
  accessibility: 100,
  'best-practices': 95,
  seo: 100,
};

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.webm': 'video/webm', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json',
};

const failures = [];
const fail = (preset, msg) => failures.push(`${preset}: ${msg}`);

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, shell: false });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code, out }));
  });
}

async function walk(dir) {
  const found = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) found.push(...(await walk(p)));
    else found.push(p);
  }
  return found;
}

/** Every internal href/src must resolve to a file in the build. */
async function checkLinks(root, preset) {
  const files = await walk(root);
  const assets = new Set(files.map((f) => '/' + path.relative(root, f).split(path.sep).join('/')));
  const resolves = (href) => {
    const clean = href.split('#')[0].split('?')[0];
    if (clean === '') return true;
    return (
      assets.has(clean) ||
      assets.has(clean.endsWith('/') ? clean + 'index.html' : clean + '/index.html') ||
      assets.has(clean + '.html')
    );
  };

  let checked = 0;
  let broken = 0;
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    const html = await readFile(f, 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|tel:|data:|#)/.test(href) || !href.startsWith('/')) continue;
      checked++;
      if (!resolves(href)) {
        broken++;
        if (broken <= 3) fail(preset, `broken link ${href} on /${path.relative(root, f)}`);
      }
    }
  }
  if (broken > 3) fail(preset, `…and ${broken - 3} more broken links`);
  return { checked, broken };
}

/**
 * og:image is a meta tag, so the link checker above never sees it — and it pointed
 * at a non-existent path for the whole of phases 1-3 without anything noticing.
 */
async function checkOgImages(root, preset) {
  const files = (await walk(root)).filter((f) => f.endsWith('index.html'));
  let missing = 0;
  for (const f of files) {
    const html = await readFile(f, 'utf8');
    const m = html.match(/property="og:image" content="([^"]*)"/);
    if (!m) {
      missing++;
      fail(preset, `no og:image on /${path.relative(root, f)}`);
      continue;
    }
    const rel = m[1].replace(/^https?:\/\/[^/]+/, '');
    if (!existsSync(path.join(root, rel))) {
      missing++;
      if (missing <= 3) fail(preset, `og:image 404 -> ${rel}`);
    }
  }
  return { pages: files.length, missing };
}

function serve(root) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(root, p);
    if (!path.extname(f)) f = path.join(f, 'index.html');
    readFile(f)
      .then((d) => {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
        res.end(d);
      })
      .catch(() => {
        res.writeHead(404);
        res.end();
      });
  });
  return new Promise((resolve) => srv.listen(PORT, () => resolve(srv)));
}

/** Horizontal overflow is invisible to Lighthouse but obvious to a visitor. */
async function checkResponsive(chrome, url, preset) {
  const bad = [];
  for (const width of [360, 768, 1440]) {
    const res = await fetch(`http://127.0.0.1:${chrome.port}/json/new?${url}`, { method: 'PUT' });
    const { webSocketDebuggerUrl, id } = await res.json();
    const ws = new WebSocket(webSocketDebuggerUrl);
    let msgId = 0;
    const pending = new Map();
    const send = (method, params = {}) =>
      new Promise((r) => {
        const i = ++msgId;
        pending.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      }
    };
    await new Promise((r) => (ws.onopen = r));
    await send('Emulation.setDeviceMetricsOverride', {
      width, height: 800, deviceScaleFactor: 1, mobile: width < 768,
    });
    await send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1200));
    const { result } = await send('Runtime.evaluate', {
      expression: 'document.documentElement.scrollWidth <= window.innerWidth + 1',
      returnByValue: true,
    });
    if (!result.value) bad.push(width);
    ws.close();
    await fetch(`http://127.0.0.1:${chrome.port}/json/close/${id}`);
  }
  if (bad.length) fail(preset, `horizontal overflow at ${bad.join(', ')}px on ${url}`);
  return bad.length === 0;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => PRESETS.includes(a));
  const targets = only.length ? only : PRESETS;

  console.log(`\nStress test — presets: ${targets.join(', ')}\n`);

  process.stdout.write('  astro check … ');
  const check = await run('pnpm', ['exec', 'astro', 'check']);
  const errs = /- (\d+) errors/.exec(check.out);
  if (!errs || errs[1] !== '0') {
    console.log('FAIL');
    failures.push(`astro check reported ${errs ? errs[1] : '?'} error(s)`);
  } else {
    console.log('0 errors');
  }

  await rm(OUT, { recursive: true, force: true });

  // Build every preset first, so a build failure surfaces before any Chrome work.
  for (const preset of targets) {
    process.stdout.write(`  build ${preset.padEnd(8)} … `);
    const b = await run('pnpm', ['exec', 'astro', 'build'], { DS_PRESET: preset });
    if (b.code !== 0) {
      console.log('FAIL');
      const reason = b.out.split('\n').filter((l) => /error|Error/.test(l)).slice(0, 2).join(' | ');
      fail(preset, `build failed — ${reason || 'see output'}`);
      continue;
    }
    await cp('dist', path.join(OUT, preset), { recursive: true });
    const pages = (await walk(path.join(OUT, preset))).filter((f) => f.endsWith('index.html')).length;
    console.log(`ok (${pages} pages)`);
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  const rows = [];
  try {
    for (const preset of targets) {
      const root = path.join(OUT, preset);
      if (!existsSync(root)) continue;

      const links = await checkLinks(root, preset);
      const og = await checkOgImages(root, preset);

      const srv = await serve(root);
      try {
        for (const page of SAMPLE) {
          const url = `http://localhost:${PORT}${page}`;
          const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'silent' });

          const scores = {};
          for (const [key, cat] of Object.entries(lhr.categories)) {
            scores[key] = Math.round(cat.score * 100);
            const min = THRESHOLDS[key];
            if (min !== undefined && scores[key] < min) {
              fail(preset, `${page} ${key} ${scores[key]} < ${min}`);
            }
          }

          const contrast = lhr.audits['color-contrast'];
          if (contrast.score !== 1) {
            const sel = (contrast.details?.items ?? []).map((i) => i.node?.selector).slice(0, 2);
            fail(preset, `${page} colour-contrast FAIL ${JSON.stringify(sel)}`);
          }

          const ok = await checkResponsive(chrome, url, preset);

          rows.push({
            preset, page,
            perf: scores.performance, a11y: scores.accessibility,
            bp: scores['best-practices'], seo: scores.seo,
            contrast: contrast.score === 1 ? 'pass' : 'FAIL',
            responsive: ok ? 'ok' : 'OVERFLOW',
            links: `${links.checked}/${links.broken}`,
            og: og.missing === 0 ? 'ok' : `${og.missing} bad`,
          });
        }
      } finally {
        srv.close();
      }
    }
  } finally {
    await chrome.kill();
  }

  console.log(
    `\n  ${'preset'.padEnd(9)}${'page'.padEnd(19)}${'perf'.padEnd(6)}${'a11y'.padEnd(6)}` +
      `${'bp'.padEnd(5)}${'seo'.padEnd(5)}${'contrast'.padEnd(10)}${'responsive'.padEnd(12)}` +
      `${'links c/b'.padEnd(12)}og`,
  );
  for (const r of rows) {
    console.log(
      `  ${r.preset.padEnd(9)}${r.page.padEnd(19)}${String(r.perf).padEnd(6)}${String(r.a11y).padEnd(6)}` +
        `${String(r.bp).padEnd(5)}${String(r.seo).padEnd(5)}${r.contrast.padEnd(10)}` +
        `${r.responsive.padEnd(12)}${r.links.padEnd(12)}${r.og}`,
    );
  }

  if (failures.length) {
    console.log(`\n  ${failures.length} failure(s):`);
    for (const f of failures) console.log(`    · ${f}`);
    console.log('');
    process.exit(1);
  }

  console.log('\n  all checks passed\n');
}

main().catch((e) => {
  console.error('\nstress run crashed:', e);
  process.exit(1);
});
