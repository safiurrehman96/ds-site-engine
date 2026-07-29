// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { siteConfig } from './src/lib/site-config';
import { assetBudget } from './src/integrations/asset-budget';

export default defineConfig({
  site: siteConfig.site.url,
  integrations: [
    assetBudget(),
    sitemap({
      // Both of these are noindexed, and a noindexed page in the sitemap is a
      // contradiction Search Console reports as an error. /styleguide is internal
      // (spec §10); /booking-confirmed is a post-conversion endpoint that should only
      // ever be reached by redirect from a GHL calendar.
      filter: (page) => !page.includes('/styleguide') && !page.includes('/booking-confirmed'),
    }),
  ],
});
