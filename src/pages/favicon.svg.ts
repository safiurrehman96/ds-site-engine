/**
 * Favicon, generated from the active accent.
 *
 * Previously a static file in public/ with one client's teal baked in — the only
 * client-specific colour that had leaked into the engine, and it did not follow
 * theme.accentColor.
 *
 * TODO(phase-5): let a client supply their own mark via the payload and serve that
 * instead when present.
 */
import type { APIRoute } from 'astro';
import { siteConfig } from '../lib/site-config';
import { getPreset, pickOnAccent } from '../styles/presets';

export const GET: APIRoute = () => {
  const { accentColor, preset } = siteConfig.theme;
  // Same derivation as --ds-on-accent, so the mark cannot end up with an
  // illegible glyph on a light accent while the buttons on the page are fine.
  const onAccent = pickOnAccent(accentColor, getPreset(preset).colors.onAccent);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="${accentColor}"/>
<path fill="${onAccent}" d="M16 5.5c3.9 4.6 7 8.6 7 11.9a7 7 0 1 1-14 0c0-3.3 3.1-7.3 7-11.9Zm-3.6 12.1a1.1 1.1 0 0 0-1.1 1.1 4.7 4.7 0 0 0 4.7 4.7 1.1 1.1 0 0 0 0-2.2 2.5 2.5 0 0 1-2.5-2.5 1.1 1.1 0 0 0-1.1-1.1Z"/>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=604800',
    },
  });
};
