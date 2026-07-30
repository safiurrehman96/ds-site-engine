/**
 * Shared helpers for managing the background `astro dev` server.
 *
 * WHY A DEFERRED RESTART EXISTS
 * A running dev server cannot survive the `client` symlink moving under it: the
 * content glob resolves through the link, so the watcher and content store key on
 * `clients/<slug>/…` and the swap produces no watcher event. The store stays built
 * for the previous payload and requests throw "Missing payload file" for files that
 * are plainly on disk. The only reliable repair is a restart with `--force`.
 *
 * But WHEN to restart matters. The link usually moves inside `prebuild`/`prestress`
 * — i.e. an `astro build` is about to run in the same project directory. Restarting
 * immediately puts the new server's startup sync in a race with that build over the
 * shared `.astro/` state (the first attempt did exactly this, and the restarted
 * server came up logging "Astro config changed → Clearing content store" with an
 * empty store persisted — a delayed-death time bomb). So under a pre* hook the
 * restart is deferred: a marker file is written, and the matching post* hook
 * restarts the server once every other astro process is finished and gone.
 */
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';

const DEV_STATE = path.join('.astro', 'dev.json');
export const RESTART_MARKER = path.join('.astro', 'dev-restart-needed');

const exec = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}` }),
    );
  });

/** The background dev server's recorded state, or null when none is alive. */
export async function runningDevServer() {
  try {
    const state = JSON.parse(await readFile(DEV_STATE, 'utf8'));
    if (!state?.pid) return null;
    // Signal 0 tests liveness without touching the process; throws if it is gone.
    process.kill(state.pid, 0);
    return state;
  } catch {
    return null;
  }
}

/** Record that the running dev server is stale and must be restarted by a post* hook. */
export async function markRestartNeeded(reason) {
  await writeFile(RESTART_MARKER, `${reason}\n`);
}

export async function clearRestartMarker() {
  await rm(RESTART_MARKER, { force: true });
}

/**
 * Stop and relaunch the background dev server on its recorded port.
 *
 * The stale content store is repaired by DELETING `.astro/data-store.json` between
 * stop and start — deliberately not with `--force`. `--force` requests the in-process
 * "clear the store, then resync" path, and in astro 7.1.5 that path is the bug, not
 * the fix: after a clear the loaders never repopulate, and the server comes up
 * logging "Astro config changed → Clearing content store → Synced content" with every
 * collection an empty Map (reproduced; also the shape of the original pid-95279
 * incident, where a content.config.ts edit cleared the store and killed the server).
 * The same clear fires on its own whenever the previous writer of the store file was
 * an `astro build`, whose config digest never matches the dev server's. A missing
 * file has no digest to mismatch, so booting from nothing takes the genuine
 * full-load path instead. Verified: restart with --force → 500s; restart with the
 * store deleted → 200s.
 */
export async function restartDevServer(reason) {
  const server = await runningDevServer();
  if (!server) {
    await clearRestartMarker();
    return false;
  }

  const stop = await exec('pnpm', ['exec', 'astro', 'dev', 'stop']);
  if (!stop.ok) {
    console.warn(`⚠️  could not stop dev server (pid ${server.pid}) — restart it by hand: pnpm dev`);
    return false;
  }

  /*
   * `astro dev stop` returns before the old process has actually exited. Booting the
   * replacement inside that window means two servers briefly share `.astro/` — and the
   * dying one flushes its (now wrong) content store over whatever the new one is
   * setting up. Both observed mid-flight deaths followed exactly this kind of rapid
   * stop/start cycle, with nothing in the new server's log because the fatal write
   * came from the old process. So: wait for the pid to be truly gone first.
   */
  for (let i = 0; i < 50; i++) {
    try {
      process.kill(server.pid, 0);
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      break; // gone
    }
  }

  /*
   * Fully cold boot: wipe .astro/ and vite's dep cache, not just data-store.json.
   *
   * Deleting only the store turned out to be insufficient — with the rest of .astro/
   * (collections/, generated content modules) and node_modules/.vite carried over
   * from a server that ran a different client, the new server logs a clean
   * "Syncing content → Synced content" and still comes up missing entries. Torture
   * test that settled it: alternating `pnpm use kleen` / `pnpm use jetspa` with a
   * store-only wipe went 200/500/200/500; with the full wipe it holds 200 across
   * every switch. Everything removed here is a cache astro rebuilds on boot.
   */
  await rm('.astro', { recursive: true, force: true });
  await rm(path.join('node_modules', '.vite'), { recursive: true, force: true });

  const start = await exec('pnpm', [
    'exec', 'astro', 'dev', '--background', '--port', String(server.port),
  ]);
  await clearRestartMarker();
  console.log(
    start.ok
      ? `↻ restarted dev server on port ${server.port} (${reason})`
      : `⚠️  stopped the stale dev server but could not restart it — run: pnpm dev`,
  );
  return start.ok;
}

/** True when a restart has been deferred by a pre* hook. */
export function restartPending() {
  return existsSync(RESTART_MARKER);
}
