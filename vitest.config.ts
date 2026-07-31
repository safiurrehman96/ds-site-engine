import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit tests target the pure logic in src/lib — prose classification, SEO formulas,
 * block composition, legal templates. Those modules import from 'astro:content',
 * a virtual module that only exists inside an Astro build, so the tests alias it to
 * a controllable stub (test/stubs/astro-content.ts).
 */
export default defineConfig({
  resolve: {
    alias: {
      'astro:content': fileURLToPath(new URL('./test/stubs/astro-content.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
