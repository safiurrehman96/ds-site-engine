import { describe, expect, it } from 'vitest';
import { composeBlocks, CALLOUT_MAX_WORDS } from '../src/lib/compose';

const prose = (words: number) => Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
const structured = '**A.** one.\n\n**B.** two.';
const image = { src: './assets/x.jpg', alt: 'x' };

const block = (over: Partial<{ body: string; image: typeof image }> = {}) => ({
  heading: 'H',
  body: over.body ?? prose(80),
  ...(over.image ? { image: over.image } : {}),
});

describe('composeBlocks', () => {
  it('rotates photo variants over photo blocks only, skipping text between them', () => {
    const result = composeBlocks([
      block({ image }),
      block(),
      block({ image }),
      block({ image }),
    ]);
    const photos = result.filter((r) => r.kind === 'photo');
    expect(photos.map((p) => p.variant)).toEqual(['beside', 'wide', 'stack']);
  });

  it('keeps a photo block with structured copy on the rail — the photo never halves a grid', () => {
    const [entry] = composeBlocks([block({ image, body: structured })]);
    expect(entry).toMatchObject({ kind: 'copy', layout: 'rail' });
  });

  it('promotes at most one short prose block to a callout, never the opener', () => {
    const short = prose(CALLOUT_MAX_WORDS);
    const result = composeBlocks([block({ body: short }), block({ body: short }), block({ body: short })]);
    expect(result[0].kind).toBe('copy'); // opener never shouts
    expect(result.filter((r) => r.kind === 'callout')).toHaveLength(1);
  });

  it('never promotes structured copy to a callout, however short', () => {
    const result = composeBlocks([block(), block({ body: structured })]);
    expect(result[1]).toMatchObject({ kind: 'copy', layout: 'rail' });
  });

  it('respects allowCallout: false for continuation runs', () => {
    const result = composeBlocks([block(), block({ body: prose(10) })], { allowCallout: false });
    expect(result.every((r) => r.kind !== 'callout')).toBe(true);
  });

  it('word-counts the callout threshold exactly', () => {
    const at = composeBlocks([block(), block({ body: prose(CALLOUT_MAX_WORDS) })]);
    const over = composeBlocks([block(), block({ body: prose(CALLOUT_MAX_WORDS + 1) })]);
    expect(at[1].kind).toBe('callout');
    expect(over[1].kind).toBe('copy');
  });

  it('adjacency pass: a repeating copy layout flips when the body is prose', () => {
    const result = composeBlocks([block(), block()]);
    const layouts = result.map((r) => (r.kind === 'copy' ? r.layout : null));
    expect(layouts[0]).not.toBe(layouts[1]);
  });

  it('adjacency pass never moves structured copy off the rail', () => {
    const result = composeBlocks([block({ body: structured }), block({ body: structured })]);
    expect(result.map((r) => (r.kind === 'copy' ? r.layout : null))).toEqual(['rail', 'rail']);
  });

  it('threads startIndex through split indices for alternation continuity', () => {
    const result = composeBlocks([block(), block({ image })], { startIndex: 3 });
    const indices = result.map((r) => ('index' in r ? r.index : null));
    expect(indices).toEqual([3, 4]);
  });
});
