/**
 * Build-time asset budgets.
 *
 * Hero video autoplays on every page, so an oversized file is paid for on every
 * page view — and Lighthouse will not catch it, because the poster carries LCP and
 * the score barely moves. This fails the build instead.
 */
import type { AstroIntegration } from 'astro';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const BUDGETS_KB: Array<{ match: RegExp; max: number; label: string }> = [
  { match: /\.(webm|mp4)$/i, max: 1536, label: 'hero video' },
  { match: /\.(jpe?g|png|webp|avif)$/i, max: 600, label: 'image' },
];

export function assetBudget(dir = 'client/assets'): AstroIntegration {
  return {
    name: 'ds:asset-budget',
    hooks: {
      'astro:build:start': async ({ logger }) => {
        let files: string[];
        try {
          files = await readdir(dir);
        } catch {
          logger.warn(`${dir} not found — skipping asset budget check.`);
          return;
        }

        const failures: string[] = [];
        for (const name of files) {
          const budget = BUDGETS_KB.find((b) => b.match.test(name));
          if (!budget) continue;
          const { size } = await stat(join(dir, name));
          const kb = Math.round(size / 1024);
          if (kb > budget.max) {
            failures.push(
              `  · ${name} is ${kb}KB — over the ${budget.max}KB ${budget.label} budget`,
            );
          }
        }

        if (failures.length) {
          throw new Error(
            `Payload assets exceed their size budget:\n${failures.join('\n')}\n\n` +
              `Re-encode before building. For hero video, 1280x720 VP9 at CRF 40 is a good\n` +
              `starting point:\n` +
              `  ffmpeg -i in.webm -c:v libvpx-vp9 -b:v 0 -crf 40 -vf scale=1280:-2 -an out.webm`,
          );
        }

        logger.info('asset budgets ok');
      },
    },
  };
}
