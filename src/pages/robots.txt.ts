/**
 * Generated per client at build time, because the Sitemap line needs the client's
 * absolute origin — a static public/robots.txt would hardcode one domain into the
 * engine.
 *
 * Deliberately no Disallow rule for noindex routes: a disallowed page cannot be
 * crawled, so its noindex is never seen. The meta tag is the mechanism.
 */
import type { APIRoute } from 'astro';
import { siteConfig } from '../lib/site-config';

export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${siteConfig.site.url}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
