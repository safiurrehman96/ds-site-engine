/**
 * Publishes the sitemap at /sitemap.xml.
 *
 * @astrojs/sitemap always writes sitemap-index.xml (+ numbered chunks) and offers
 * no flat-file option — a sound scalability default, but everyone internally looks
 * for /sitemap.xml and reads its absence as "no sitemap". A sitemap index is valid
 * at any filename, so this copies the index to the conventional name after the
 * sitemap integration has written it. robots.txt points at /sitemap.xml.
 *
 * Must be listed AFTER sitemap() in astro.config.mjs — both run on
 * astro:build:done, in listed order.
 */
import type { AstroIntegration } from 'astro';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export function sitemapAlias(): AstroIntegration {
  return {
    name: 'ds:sitemap-alias',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        try {
          await copyFile(join(out, 'sitemap-index.xml'), join(out, 'sitemap.xml'));
          logger.info('sitemap.xml created (copy of sitemap-index.xml)');
        } catch {
          logger.warn('sitemap-index.xml not found — /sitemap.xml not created.');
        }
      },
    },
  };
}
