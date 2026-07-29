/**
 * The single entry point for the active client's config.
 *
 * The payload (`clients/<slug>/site.config.ts`, reached through the `client` symlink)
 * exports a plain object and imports nothing. Validation happens here instead, for
 * two reasons:
 *
 * 1. A payload that imports engine code cannot express a path that works everywhere.
 *    Vite resolves `client/` to its real location before resolving imports, so it
 *    needs `../../src/...`; TypeScript follows the symlink as written, so it needs
 *    `../src/...`. Only one of the two can be right. A payload with no imports at all
 *    has no such problem — and is portable if a client is ever split into its own repo.
 * 2. One validation site rather than one per payload: every client is parsed by the
 *    same call, so no payload can skip it.
 *
 * Engine code imports `siteConfig` from here, never from the payload directly.
 */
import { defineSiteConfig } from '../config-schema';
import { siteConfig as raw } from '../../client/site.config';

export const siteConfig = defineSiteConfig(raw);

/**
 * Placeholder facts are allowed, but never quietly.
 *
 * A payload may carry stand-in values so a site can be built and reviewed before
 * onboarding finishes. The danger is not the placeholder — it is forgetting it, so
 * every one announces itself on every build, by field path.
 *
 * Set DS_STRICT=1 to make that fatal. Any deploy pipeline should: the failure mode
 * this prevents is a real customer calling a fake phone number.
 */
const PLACEHOLDER = 'PLACEHOLDER';

function placeholderPaths(value: unknown, path: string[] = []): string[] {
  if (typeof value === 'string') {
    return value.includes(PLACEHOLDER) ? [`${path.join('.')} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => placeholderPaths(v, [...path, String(i)]));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => placeholderPaths(v, [...path, k]));
  }
  return [];
}

const placeholders = placeholderPaths(siteConfig);

if (placeholders.length) {
  const report =
    `${placeholders.length} placeholder value(s) in client/site.config.ts — this payload is not launch-ready:\n` +
    placeholders.map((p) => `  · ${p}`).join('\n');

  if (process.env.DS_STRICT === '1') {
    throw new Error(`${report}\n\nDS_STRICT=1 is set, so this is a build failure.`);
  }
  console.warn(`\n⚠️  ${report}\n`);
}

export default siteConfig;
