/**
 * /rss.xml — blog feed. Built like robots.txt/llms.txt: derived per client at build
 * time. With zero published posts the feed still exists but is empty, which readers
 * treat as "no items yet" — unlike an empty /blog page, an empty feed is valid.
 */
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { siteConfig } from '../lib/site-config';
import { getPosts } from '../lib/content';

export const GET: APIRoute = async (context) => {
  const posts = await getPosts();
  const { brand, seo, serviceArea } = siteConfig;

  return rss({
    title: `${brand.name} Blog`,
    description: `${seo.category} tips, guides, and news from ${brand.name}, serving ${serviceArea.label}.`,
    site: context.site ?? siteConfig.site.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.metaDescription,
      link: `/blog/${post.data.slug}/`,
      pubDate: post.data.publishDate,
    })),
  });
};
