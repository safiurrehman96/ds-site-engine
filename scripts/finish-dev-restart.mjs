/**
 * post* hook: restart the dev server if a pre* hook deferred it.
 *
 * Runs after build / stress / check / preview. By now every other astro process in
 * this project directory has exited, so the fresh server's startup sync has `.astro/`
 * to itself — the concurrency that corrupted the store when the restart happened
 * inside the pre* hook cannot occur.
 *
 * No marker, nothing to do: the common case costs one existsSync.
 */
import { restartPending, restartDevServer } from './dev-server.mjs';

if (restartPending()) {
  await restartDevServer('the client link moved during this run; its content store was stale');
}
