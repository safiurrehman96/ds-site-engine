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
import { readdir, readlink, rm, symlink, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
