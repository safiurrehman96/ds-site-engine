/**
 * Selects the active payload.
 *
 *   pnpm use jetspa          switch to clients/jetspa
 *   DS_CLIENT=jetspa pnpm build
 *   pnpm use                 re-link whatever DS_CLIENT / the current link says
 *
 * HOW IT WORKS
 * `client/` is a symlink to `clients/<slug>/`, not a directory. Thirty engine files
 * import the payload by relative path, and three `import.meta.glob` calls hardcode
 * `../../client/assets/**` — Vite requires those patterns to be static literals, so
 * an env-var-driven path is not possible without rewriting all of them. Moving the
 * link instead of the paths keeps every one of them working untouched.
 *
 * Runs automatically before dev/build/preview/stress via the pre* scripts in
 * package.json, so a stale link cannot quietly build the wrong client: every entry
 * point re-establishes it from DS_CLIENT first.
 */
import { readdir, readlink, readFile, rm, symlink, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';

const CLIENTS_DIR = 'clients';
const LINK = 'client';
/** Per-client Cloudflare/Netlify-style redirects, staged into the shared public/. */
const REDIRECTS = '_redirects';

async function listClients() {
  const entries = await readdir(CLIENTS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

function fail(message, clients) {
  console.error(`✗ ${message}`);
  if (clients?.length) console.error(`  Available: ${clients.join(', ')}`);
  process.exit(1);
}

/** The current link target, or null when there is no link. */
async function currentClient() {
  try {
    const link = await readlink(LINK);
    return path.basename(link);
  } catch {
    return null;
  }
}

const DEV_STATE = path.join('.astro', 'dev.json');

const exec = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ''}${stderr ?? ''}` }),
    );
  });

/** The background dev server's recorded state, or null when none is alive. */
async function runningDevServer() {
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

/**
 * A running `astro dev` cannot survive the link moving under it, so restart it.
 *
 * Collections load through a glob over `client/content/**`, and both Vite's watcher and
 * Astro's content store key on the *resolved* path — `clients/jetspa/…`, not `client/…`.
 * Repointing the symlink changes what that pattern resolves to without touching any
 * watched file, so nothing invalidates: the server keeps serving a store built for the
 * previous payload and the next request throws "Missing payload file" for a file that is
 * sitting on disk. `.astro/data-store.json` shows it plainly — every collection an empty
 * Map.
 *
 * This used to be a warning. A warning was the wrong shape: the link moves as a *side
 * effect* of `DS_CLIENT=kleen pnpm build` or `pnpm run stress` in another terminal, so the
 * person who has to act on it is not the person who ran the command, and it was ignored
 * every single time — including by the author of the warning, twice in one session. The
 * state is recoverable automatically, so recover it.
 *
 * `--force` clears the content layer cache, which is exactly the invalidation the swap
 * failed to trigger. Skipped under `predev`, which is about to start a server of its own,
 * and under DS_NO_DEV_RESTART=1 for anyone who would rather it kept its hands off.
 */
async function restartDevServerIfRunning(from, to) {
  if (process.env.npm_lifecycle_event === 'predev') return;

  const server = await runningDevServer();
  if (!server) return;

  if (process.env.DS_NO_DEV_RESTART === '1') {
    console.warn(
      `\n⚠️  dev server (pid ${server.pid}) is stale: the client link moved ${from ?? 'unset'} → ${to}.\n` +
        `   DS_NO_DEV_RESTART=1 is set, so it was left alone. Requests will fail with\n` +
        `   "Missing payload file" until you run: astro dev stop, then pnpm dev\n`,
    );
    return;
  }

  const stop = await exec('pnpm', ['exec', 'astro', 'dev', 'stop']);
  if (!stop.ok) {
    console.warn(`⚠️  could not stop dev server (pid ${server.pid}) — restart it by hand.`);
    return;
  }

  const args = ['exec', 'astro', 'dev', '--background', '--force', '--port', String(server.port)];
  const start = await exec('pnpm', args);
  console.log(
    start.ok
      ? `↻ restarted dev server on port ${server.port} (the link moved, its content store was stale)`
      : `⚠️  stopped the stale dev server but could not restart it — run: pnpm dev`,
  );
}

async function main() {
  if (!existsSync(CLIENTS_DIR)) fail(`No ${CLIENTS_DIR}/ directory.`);
  const clients = await listClients();
  if (!clients.length) fail(`${CLIENTS_DIR}/ is empty.`);

  const arg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const existing = await currentClient();
  const slug = arg ?? process.env.DS_CLIENT ?? existing;

  if (!slug) {
    fail('No client selected. Pass one, or set DS_CLIENT.', clients);
  }
  if (!clients.includes(slug)) {
    fail(`Unknown client "${slug}".`, clients);
  }

  // Refuse to delete a real directory. If client/ is not a symlink, someone has
  // edited a payload in place and the contents are not in clients/ — removing it
  // would destroy work that has no other copy.
  if (existsSync(LINK) && existing === null) {
    const info = await stat(LINK);
    fail(
      `${LINK}/ is a real ${info.isDirectory() ? 'directory' : 'file'}, not a symlink. ` +
        `Move it into ${CLIENTS_DIR}/<slug>/ first — this script will not delete it.`,
    );
  }

  if (existing !== slug) {
    await rm(LINK, { force: true });
    await symlink(path.join(CLIENTS_DIR, slug), LINK);
  }

  // public/ is shared engine territory (fonts); redirects are per client and would
  // otherwise leak one client's 301s into the next client's build.
  const source = path.join(CLIENTS_DIR, slug, REDIRECTS);
  const target = path.join('public', REDIRECTS);
  if (existsSync(source)) {
    await copyFile(source, target);
  } else {
    await rm(target, { force: true });
  }

  console.log(`▸ client: ${slug}${existing === slug ? '' : ` (was ${existing ?? 'unset'})`}`);

  // After the link and _redirects are both settled, so a restarted server reads the
  // finished state rather than a half-applied one.
  if (existing !== slug) await restartDevServerIfRunning(existing, slug);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
