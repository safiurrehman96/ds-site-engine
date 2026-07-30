/**
 * Generated per client at build time, because the Sitemap line needs the client's
 * absolute origin — a static public/robots.txt would hardcode one domain into the
 * engine.
 *
 * Deliberately no Disallow rules for the noindex routes (/styleguide,
 * /booking-confirmed): a disallowed page cannot be crawled, so its noindex is
 * never seen and the URL can still be indexed from external links. The meta tag
 * is the mechanism; robots.txt stays out of its way.
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
