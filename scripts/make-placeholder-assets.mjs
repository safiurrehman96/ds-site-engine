/**
 * Generates stand-in assets so a payload can build before real photography exists.
 *
 *   pnpm run placeholders jetspa
 *
 * Every file it writes is deliberately, visibly fake: flat colour, the word
 * PLACEHOLDER across it, and the filename baked into the image. That is the whole
 * design. A neutral-looking stock photo would survive review and ship; a slab of grey
 * with PLACEHOLDER on it cannot. The same reasoning applies to the placeholder facts
 * in a generated site.config.ts.
 *
 * Never reuse another client's photography as a stand-in. Beyond the licensing
 * question, source photography can carry another company's branding — exactly
 * the kind of thing that gets noticed after launch, not before.
 *
 * Requires ffmpeg for the hero video (`brew install ffmpeg`); images use sharp, which
 * is already a dev dependency.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import sharp from 'sharp';

const run = promisify(execFile);

const slug = process.argv.slice(2).find((a) => !a.startsWith('-'));
if (!slug) {
  console.error('Usage: pnpm run placeholders <slug>');
  process.exit(1);
}

const DIR = path.join('clients', slug, 'assets');

/** Muted greys only — nothing that could be mistaken for a brand colour. */
const BG = '#3b4248';
const FG = '#aab4bc';

function svg(width, height, label, sub) {
  const title = Math.round(Math.min(width, height) / 9);
  const small = Math.round(title * 0.42);
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${BG}"/>
      <g fill="${FG}" font-family="Helvetica, Arial, sans-serif" text-anchor="middle">
        <text x="50%" y="47%" font-size="${title}" font-weight="700" letter-spacing="2">${label}</text>
        <text x="50%" y="47%" dy="${title * 0.9}" font-size="${small}">${sub}</text>
      </g>
      <rect x="8" y="8" width="${width - 16}" height="${height - 16}"
            fill="none" stroke="${FG}" stroke-width="4" stroke-dasharray="18 12"/>
    </svg>`);
}

const IMAGES = [
  { file: 'logo.jpg', w: 600, h: 200, label: 'PLACEHOLDER', sub: 'logo' },
  { file: 'hero-poster.jpg', w: 1600, h: 900, label: 'PLACEHOLDER', sub: 'hero poster' },
  { file: 'social.jpg', w: 1200, h: 630, label: 'PLACEHOLDER', sub: 'social share image' },
  { file: 'intro.jpg', w: 1200, h: 900, label: 'PLACEHOLDER', sub: 'home intro photo' },
];

/** One hero image per service, named by the convention the payloads already use. */
async function serviceImages() {
  const intake = path.join('clients', slug, 'source', 'intake.json');
  if (!existsSync(intake)) return [];

  const { pages } = JSON.parse(await readFile(intake, 'utf8'));
  return (pages?.services ?? []).map((s) => ({
    file: `service-${s.slug}.jpg`,
    w: 1200,
    h: 900,
    label: 'PLACEHOLDER',
    sub: s.name,
  }));
}

async function main() {
  await mkdir(DIR, { recursive: true });

  for (const img of [...IMAGES, ...(await serviceImages())]) {
    const out = path.join(DIR, img.file);
    await sharp(svg(img.w, img.h, img.label, img.sub))
      .jpeg({ quality: 82 })
      .toFile(out);
    console.log(`  ▸ ${out}`);
  }

  // The hero video: 6 seconds of the same slab, looped by the player. Encoded twice
  // because a WebM-only hero silently shows the poster to most of iOS and Safari.
  const posterPath = path.join(DIR, 'hero-poster.jpg');
  const common = ['-loop', '1', '-t', '6', '-i', posterPath, '-r', '12', '-an', '-y'];

  await run('ffmpeg', [
    ...common,
    '-c:v', 'libvpx-vp9', '-b:v', '150k', '-pix_fmt', 'yuv420p',
    path.join(DIR, 'hero.webm'),
  ]);
  console.log(`  ▸ ${path.join(DIR, 'hero.webm')}`);

  await run('ffmpeg', [
    ...common,
    '-c:v', 'libx264', '-profile:v', 'main', '-crf', '30', '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(DIR, 'hero.mp4'),
  ]);
  console.log(`  ▸ ${path.join(DIR, 'hero.mp4')}`);

  console.log(
    `\n✓ placeholder assets in ${DIR}\n` +
      `  Replace every one before launch. They are meant to look wrong.\n`,
  );
}

main().catch((err) => {
  console.error(err.stderr ?? err);
  if (!existsSync('/opt/homebrew/bin/ffmpeg') && !existsSync('/usr/bin/ffmpeg')) {
    console.error('\nffmpeg not found — install it with: brew install ffmpeg');
  }
  process.exit(1);
});
