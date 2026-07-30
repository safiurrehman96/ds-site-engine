// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { siteConfig } from './src/lib/site-config';
import { assetBudget } from './src/integrations/asset-budget';
import { sitemapAlias } from './src/integrations/sitemap-alias';

export default defineConfig({
  site: siteConfig.site.url,
  vite: {
    server: {
      watch: {
        // stress.mjs copies a full dist/ per preset into .stress/. Astro ignores its
        // own outDir but knows nothing about this one, so a stress run flooded the
        // dev server's watcher with one event per built file (~70 per preset).
        ignored: ['**/.stress/**'],
      },
    },
  },
  integrations: [
    assetBudget(),
    sitemap({
      // Both of these are noindexed, and a noindexed page in the sitemap is a
      // contradiction Search Console reports as an error. /styleguide is internal
      // (spec §10); /booking-confirmed is a post-conversion endpoint that should only
      // ever be reached by redirect from a GHL calendar.
      filter: (page) => !page.includes('/styleguide') && !page.includes('/booking-confirmed'),
    }),
    // After sitemap() — both hook astro:build:done, and the alias copies its output.
    sitemapAlias(),
  ],
});
