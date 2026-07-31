/**
 * Dev-server smoke test — run after every Astro upgrade.
 *
 *   pnpm smoke
 *
 * WHY THIS EXISTS
 * The client/ symlink machinery leans on undocumented Astro internals: restarts
 * boot from a wiped .astro/ because 7.1.5's clear-then-resync path leaves every
 * collection an empty Map (see scripts/dev-server.mjs). The failure mode of an
 * upgrade shifting that behaviour is silent — a dev server that boots cleanly and
 * renders from empty collections. This makes the check a command: cold-boot dev
 * exactly the way the restart machinery does, and assert the collections loaded.
 *
 * Astro dev is a per-project daemon (.astro/dev.json), so this drives it through
 * its own lifecycle commands rather than raw processes — a spawned server here
 * double-forks out of any process group and cannot be killed directly. The test
 * necessarily stops a dev server you have running; it says so when it does.
 */
import { rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { runningDevServer } from './dev-server.mjs';

const PORT = 4399;
const DEADLINE_MS = 60_000;

const astro = (...args) =>
  new Promise((resolve) => {
    execFile('pnpm', ['exec', 'astro', ...args], (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}` }),
    );
  });

const stop = () => astro('dev', 'stop');

const fail = async (msg, log = '') => {
  console.error(`smoke-dev: FAIL — ${msg}${log ? `\n\n--- dev output ---\n${log}` : ''}`);
  await stop();
  process.exit(1);
};

// One daemon per project: ours replaces any running one, and honesty beats silence.
const existing = await runningDevServer();
if (existing) {
  console.log(`smoke-dev: stopping the running dev server (port ${existing.port}) — restart it after with: pnpm dev`);
  await stop();
}

// Cold boot, the exact shape the restart machinery produces (dev-server.mjs):
// everything removed here is a cache astro rebuilds.
await rm('.astro', { recursive: true, force: true });
await rm(path.join('node_modules', '.vite'), { recursive: true, force: true });

const started = await astro('dev', '--background', '--port', String(PORT));
if (!started.ok) await fail('astro dev --background did not start', started.out);

const until = Date.now() + DEADLINE_MS;
let up = false;
while (Date.now() < until && !up) {
  try {
    up = (await fetch(`http://localhost:${PORT}/`)).ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!up) await fail(`dev server did not answer on :${PORT} within ${DEADLINE_MS / 1000}s`, started.out);

// llms.txt is built from getServices()/getAreas() — the exact calls that return
// empty Maps when the store resync bug bites. A populated Services section is
// direct evidence the collections loaded.
const llms = await (await fetch(`http://localhost:${PORT}/llms.txt`)).text();
const links = (llms.match(/^- \[/gm) ?? []).length;
if (!llms.includes('## Services') || links === 0) {
  await fail(`collections look empty — llms.txt has ${links} links:\n${llms.slice(0, 400)}`);
}

await stop();
console.log(`smoke-dev: OK — dev boots from a cold store, collections populated (${links} links in llms.txt).`);
