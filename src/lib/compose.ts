/**
 * Assigns a composition to each block in an ordered run.
 *
 * WHY THIS EXISTS
 * Every recipe has independently grown the same bug: adjacent SplitSections that
 * render identically. About had four centred columns in a row; area pages have
 * localCopy and localDetail back to back; a service page gets it the moment a payload
 * writes two prose blocks in sequence. Each recipe was fixing it locally, or not at
 * all, and a new recipe starts the cycle over.
 *
 * The rule is one rule, in one place, and every recipe runs its blocks through it.
 *
 *   photo    → beside / wide / stack, rotating over the photo blocks only, so
 *              consecutive ones never share a composition however many text blocks
 *              sit between them
 *   short    → callout, the accent panel: at most one per page, never the opening
 *              block. A second is not a second emphasis, it halves the first
 *   anything  → copy-only, which takes the layout its own content asks for —
 *   else       structured bodies want the rail so their grids get room, flowing
 *              prose wants the centred measure
 *
 * Then one adjacency pass: if a copy block would repeat the layout of the copy block
 * before it, and its body is flowing prose, it takes the other layout. Prose reads
 * acceptably centred or railed, so it is the one that can be moved. Structured copy
 * is never moved — the rail is not a preference there, it is what makes a two-column
 * checklist or points grid possible at all.
 */
import { isStructuredProse } from './content';

export type SplitVariant = 'beside' | 'overlap' | 'wide' | 'stack';
export type CopyLayout = 'centred' | 'rail';

/** The minimum a block must carry for a recipe to compose it. */
export interface ComposableBlock {
  heading: string;
  body: string;
  image?: { src: string; alt: string };
  cta?: { label: string; href: string };
}

export type Composed<T extends ComposableBlock> =
  | { block: T; kind: 'photo'; variant: SplitVariant; index: number }
  | { block: T; kind: 'callout' }
  | { block: T; kind: 'copy'; layout: CopyLayout; index: number };

/**
 * Short enough to survive being set on an accent fill. Above this a callout stops
 * reading as a statement and becomes a paragraph with a loud background.
 */
export const CALLOUT_MAX_WORDS = 60;

/** Photo blocks rotate through these. `overlap` is omitted deliberately: it needs a
 *  tall image to read, and payload photography is not reliably shot that way. */
const PHOTO_VARIANTS: SplitVariant[] = ['beside', 'wide', 'stack'];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export interface ComposeOptions {
  /**
   * Whether this run may use the callout. False for a run that is a continuation of
   * an earlier one on the same page — the "one per page" limit spans the whole page,
   * not each call.
   */
  allowCallout?: boolean;
  /** Starting index for SplitSection's own left/right alternation. */
  startIndex?: number;
}

export function composeBlocks<T extends ComposableBlock>(
  blocks: T[],
  { allowCallout = true, startIndex = 0 }: ComposeOptions = {},
): Composed<T>[] {
  let photoIndex = 0;
  let splitIndex = startIndex;
  let calloutUsed = !allowCallout;

  const composed: Composed<T>[] = blocks.map((block, i) => {
    const structured = isStructuredProse(block.body);

    /*
     * A photo only claims its own composition when the body is flowing prose.
     * Structured copy keeps the rail and takes the photo into the rail column
     * instead (SplitSection handles the placement) — `beside` would halve the body
     * width, and a checklist or points grid needs ~32rem to go two columns, which is
     * exactly where `beside`'s copy column lands. Losing the second column to make
     * room for a photo is a worse trade than putting the photo in the empty rail.
     */
    if (block.image && !structured) {
      return {
        block,
        kind: 'photo',
        variant: PHOTO_VARIANTS[photoIndex++ % PHOTO_VARIANTS.length],
        index: splitIndex++,
      };
    }

    /*
     * A callout is a short *statement*. Never block 0 — a page that opens by
     * shouting has nowhere left to go — and never structured copy, however short.
     * An area page's whyUs is a six-item checklist that lands at 59 words, and the
     * word count alone happily promoted it to an accent panel, throwing away the
     * two-column checklist that is the entire reason the copy was written as a list.
     */
    if (
      i > 0 &&
      !calloutUsed &&
      wordCount(block.body) <= CALLOUT_MAX_WORDS &&
      !structured
    ) {
      calloutUsed = true;
      return { block, kind: 'callout' };
    }

    return {
      block,
      kind: 'copy',
      layout: structured ? 'rail' : 'centred',
      index: splitIndex++,
    };
  });

  // Adjacency pass. Walks copy blocks in order and moves any that would repeat the
  // one before it — but only where the content allows, which is prose alone.
  let previousCopyLayout: CopyLayout | undefined;
  for (const entry of composed) {
    if (entry.kind !== 'copy') continue;

    if (entry.layout === previousCopyLayout && !isStructuredProse(entry.block.body)) {
      entry.layout = entry.layout === 'centred' ? 'rail' : 'centred';
    }
    previousCopyLayout = entry.layout;
  }

  return composed;
}
