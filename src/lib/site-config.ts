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

export default siteConfig;
