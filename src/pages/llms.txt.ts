/**
 * /llms.txt — the llmstxt.org convention: a markdown site summary for AI crawlers
 * and assistants, the LLM analogue of robots.txt + sitemap.
 *
 * Generated per client at build time like robots.txt, and for the same reason:
 * every line derives from config and the collections, so no payload authors it and
 * a new client gets an accurate one for free. Services and areas carry their
 * metaDescriptions — already written to be one-line summaries — so the file stays
 * useful without any llms-specific copy.
 */
import type { APIRoute } from 'astro';
import { siteConfig } from '../lib/site-config';
import { getServices, getAreas, getPosts, areaLabel } from '../lib/content';
import { canonical } from '../lib/seo';

export const GET: APIRoute = async () => {
  const { brand, contact, serviceArea, seo, site } = siteConfig;
  const [services, areas, posts] = await Promise.all([getServices(), getAreas(), getPosts()]);

  const link = (name: string, path: string, note?: string) =>
    `- [${name}](${canonical(siteConfig, path)})${note ? `: ${note}` : ''}`;

  const body = [
    `# ${brand.name}`,
    '',
    `> ${brand.blurb}`,
    '',
    `${seo.category} serving ${serviceArea.label}. Call ${contact.phoneDisplay} or email ${contact.email}.`,
    '',
    '## Services',
    '',
    ...services.map((s) => link(s.data.name, `/${s.data.slug}`, s.data.metaDescription)),
    '',
    '## Coverage Areas',
    '',
    ...areas.map((a) => link(areaLabel(a.data), `/${a.data.slug}`, a.data.metaDescription)),
    '',
    '## Company',
    '',
    link('About', '/about'),
    link('FAQs', '/faqs'),
    link('Book an appointment', '/booking'),
    link('Get a quote', '/get-quote'),
    '',
    // Section only when the client publishes natively — an empty heading is noise.
    ...(posts.length
      ? [
          '## Blog',
          '',
          ...posts.map((p) => link(p.data.title, `/blog/${p.data.slug}`, p.data.metaDescription)),
          '',
        ]
      : []),
    `Full page list: ${site.url}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
