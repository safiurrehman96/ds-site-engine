/**
 * Resolves payload assets to built URLs.
 *
 * In-page images go through Img.astro / astro:assets. This module handles the two
 * cases that cannot: the hero video, and og:image (a meta tag needs an absolute URL,
 * not an <img>).
 */
import { getImage } from 'astro:assets';
const videos = import.meta.glob('../../client/assets/**/*.{webm,mp4}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../../client/assets/**/*.{jpeg,jpg,png,webp,avif}',
  { eager: true },
);

/**
 * Absolute, built URL for an og:image.
 *
 * Naively turning "./assets/hero.jpg" into "{site}/assets/hero.jpg" produces a 404 —
 * Astro emits hashed files under /_astro. Every og:image on the site pointed at a
 * non-existent path until this was added, and nothing caught it: Lighthouse does not
 * fetch og:image, and a link checker only inspects href/src, not meta content.
 *
 * JPEG rather than WebP: several social scrapers still do not render WebP previews.
 */
export async function ogImageUrl(
  src: string,
  siteUrl: string,
): Promise<{ url: string; width: number; height: number }> {
  const key = `../../client/${src.replace(/^\.\//, '')}`;
  const entry = images[key];
  if (!entry) {
    const available = Object.keys(images).map((k) => k.replace('../../client/', './'));
    throw new Error(
      `Missing og:image asset "${src}".\n` +
        `Expected the file at client/${src.replace(/^\.\//, '')}.\n` +
        `Available:\n${available.map((a) => `  · ${a}`).join('\n')}`,
    );
  }

  const built = await getImage({ src: entry.default, width: 1200, format: 'jpeg' });
  return {
    url: new URL(built.src, siteUrl).href,
    width: built.attributes.width ?? 1200,
    height: built.attributes.height ?? 630,
  };
}

/** Built URL for places that need an image URL rather than an `<Image>` element. */
export async function imageUrl(src: string, width = 1600): Promise<string> {
  const key = `../../client/${src.replace(/^\.\//, '')}`;
  const entry = images[key];
  if (!entry) {
    throw new Error(`Missing payload image "${src}".`);
  }

  return (await getImage({ src: entry.default, width, format: 'webp' })).src;
}

export function videoUrl(src: string): string {
  const key = `../../client/${src.replace(/^\.\//, '')}`;
  const url = videos[key];
  if (!url) {
    const available = Object.keys(videos).map((k) => k.replace('../../client/', './'));
    throw new Error(
      `Missing payload video "${src}".\n` +
        `Expected the file at client/${src.replace(/^\.\//, '')}.\n` +
        (available.length
          ? `Available videos:\n${available.map((a) => `  · ${a}`).join('\n')}`
          : 'No video files found in client/assets/.'),
    );
  }
  return url;
}
