/**
 * Layer 1 of the design system (spec §13) — curated token bundles.
 *
 * An agent's entire design job is picking one of these plus an accentColor.
 * Raw design values live here and nowhere else; payloads never contain CSS.
 *
 * A preset carries more than colour: it also selects *structural* motifs
 * (section divider shape, card treatment, heading case). Those ship as data
 * attributes on <body> so components can respond without any preset-specific
 * code leaking into recipes.
 */
import type { Preset } from '../config-schema';

/** Fonts are self-hosted from /public/fonts — no third-party render blocking. */
interface FontFace {
  family: string;
  /** Variable weight range, e.g. "400 600". */
  weight: string;
  file: string;
}

const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const INTER: FontFace = { family: 'Inter', weight: '400 600', file: 'inter-latin.woff2' };

export interface PresetTokens {
  /** Human-facing name, shown in the styleguide. */
  label: string;
  fontFaces: FontFace[];
  fonts: { display: string; body: string };
  colors: {
    ink: string;
    inkSoft: string;
    paper: string;
    card: string;
    line: string;
    /** Text placed on top of accentColor. Contrast-validated below. */
    onAccent: string;
    deep: string;
    onDeep: string;
    onDeepSoft: string;
  };
  radius: { sm: string; md: string; lg: string; pill: string };
  surface: { shadow: string; shadowLg: string; border: string };
  /** Structural motifs — become data attributes on <body>. */
  motif: {
    /** Shape of the transition between stacked sections. */
    divider: 'flat' | 'angle' | 'curve';
    cardStyle: 'raised' | 'outline' | 'sheen' | 'hard';
    headingCase: 'none' | 'uppercase';
    headingTracking: string;
    /**
     * How a section head is decorated. Replaces the earlier accentRule boolean —
     * four distinct treatments read as four different design languages.
     */
    headStyle: 'rule' | 'bar' | 'line' | 'stamp';
    /** Signature pattern laid over the dark bands (TopBar, footer, SocialStrip). */
    texture: 'none' | 'glow' | 'grid' | 'sheen' | 'dots';
    /** Button personality. Buttons appear 5-10x per page, so this reads immediately. */
    buttonStyle: 'pill' | 'square' | 'hard' | 'sheen';
    /**
     * Hero composition. All four are built for a video background — the difference
     * is where the copy sits and whether the video is full-bleed or contained.
     *   fullbleed — copy left, directly on the footage (stark, editorial)
     *   centered  — copy centred over the footage (cinematic; the astro.build pattern)
     *   split     — copy on a solid panel, video contained beside it (modern, legible)
     *   card      — copy in a solid offset card over full-bleed footage (poster-like)
     */
    heroLayout: 'fullbleed' | 'centered' | 'split' | 'card';
    /**
     * How a process list is drawn.
     *   timeline — vertical rail, dots joined by a connecting line
     *   track    — horizontal line through the numbers, copy beneath
     *   numerals — oversized ghosted numbers behind the copy
     *   ledger   — full-width rows with a big index and hairline rules
     */
    stepsStyle: 'timeline' | 'track' | 'numerals' | 'ledger';
    /**
     * Closing CTA treatment.
     *   tint  — soft accent wash on the page background
     *   deep  — dark band carrying the preset's signature texture
     *   image — full-bleed photo behind a scrim, copy centred
     *   panel — a contained solid block inset from the page edges
     */
    ctaStyle: 'tint' | 'deep' | 'image' | 'panel';
    /**
     * SplitSection composition — roughly half of every page (spec §08), so this is
     * the motif that most affects overall page rhythm.
     *   beside  — image alongside copy, sides auto-alternating
     *   overlap — copy on a solid card overlapping the image
     *   wide    — full-bleed image band with copy inset over a scrim
     *   stack   — image full width above, copy centred beneath
     */
    splitStyle: 'beside' | 'overlap' | 'wide' | 'stack';
    /**
     * Footer shape. Deliberately NOT a "CTA strip" variant: every recipe already
     * ends with CTABanner directly above the footer, so a footer CTA would stack a
     * second call to action on the first.
     *   columns — five equal columns (the spec §04 default)
     *   split   — oversized brand block left, condensed link groups right
     *   compact — tight two-row arrangement, long-form copy suppressed
     *   stacked — everything centred, links in a single row
     */
    footerStyle: 'columns' | 'split' | 'compact' | 'stacked';
    /**
     * Motion character. Drives duration, easing and travel distance for the
     * scroll-reveal and hero entrance — so the presets move differently, not
     * just look different.
     */
    motion: 'calm' | 'sharp' | 'smooth' | 'snappy';
  };
  /** Hero scrim strength, as color-mix percentages over --ds-deep. */
  heroScrim: { top: number; bottom: number };
  /**
   * How far the dark bands (TopBar, footer, SocialStrip, hero scrim) are tinted
   * toward the client's accent, 0–1. Gives per-client brand presence on every page
   * without adding a second raw colour for an agent to choose. Presets whose whole
   * identity is neutral (stealth) tint less.
   */
  deepTint: number;
}

const fresh: PresetTokens = {
  label: 'Fresh — white & teal, soft, clean grotesque',
  fontFaces: [INTER, { family: 'Space Grotesk', weight: '500 700', file: 'space-grotesk-latin.woff2' }],
  fonts: {
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  colors: {
    ink: '#111a24',
    inkSoft: '#4a5a6a',
    paper: '#f6f8fa',
    card: '#ffffff',
    line: '#dde5ec',
    onAccent: '#ffffff',
    deep: '#0f1c26',
    onDeep: '#ffffff',
    onDeepSoft: '#a9bcc9',
  },
  radius: { sm: '6px', md: '10px', lg: '16px', pill: '999px' },
  surface: {
    shadow: '0 1px 2px rgba(16, 30, 40, .06), 0 2px 8px rgba(16, 30, 40, .05)',
    shadowLg: '0 4px 12px rgba(16, 30, 40, .08), 0 12px 32px rgba(16, 30, 40, .08)',
    border: '1px solid var(--ds-line)',
  },
  motif: { divider: 'curve', cardStyle: 'raised', headingCase: 'none', headingTracking: '-0.015em', headStyle: 'rule', texture: 'glow', buttonStyle: 'pill', heroLayout: 'split', stepsStyle: 'timeline', ctaStyle: 'tint', splitStyle: 'beside', footerStyle: 'columns', motion: 'calm' },
  heroScrim: { top: 55, bottom: 78 },
  deepTint: 0.16,
};

const stealth: PresetTokens = {
  label: 'Stealth — near-black, sharp corners, condensed display',
  fontFaces: [INTER, { family: 'Oswald', weight: '500 700', file: 'oswald-latin.woff2' }],
  fonts: {
    display: "'Oswald', 'Arial Narrow', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  colors: {
    ink: '#0a0a0b',
    inkSoft: '#55565c',
    paper: '#f3f3f4',
    card: '#ffffff',
    line: '#dfdfe2',
    onAccent: '#ffffff',
    deep: '#08080a',
    onDeep: '#ffffff',
    onDeepSoft: '#9a9aa2',
  },
  radius: { sm: '0px', md: '2px', lg: '3px', pill: '2px' },
  surface: {
    shadow: '0 1px 0 rgba(10, 10, 11, .10)',
    shadowLg: '0 10px 30px rgba(10, 10, 11, .16)',
    border: '1px solid var(--ds-line)',
  },
  motif: { divider: 'angle', cardStyle: 'outline', headingCase: 'uppercase', headingTracking: '0.02em', headStyle: 'bar', texture: 'grid', buttonStyle: 'square', heroLayout: 'fullbleed', stepsStyle: 'ledger', ctaStyle: 'deep', splitStyle: 'wide', footerStyle: 'compact', motion: 'sharp' },
  heroScrim: { top: 62, bottom: 88 },
  deepTint: 0.07,
};

const chrome: PresetTokens = {
  label: 'Chrome — dark blue & silver, premium, geometric',
  fontFaces: [INTER, { family: 'Sora', weight: '500 700', file: 'sora-latin.woff2' }],
  fonts: {
    display: "'Sora', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  colors: {
    ink: '#0f1729',
    inkSoft: '#4e5a70',
    paper: '#eef1f6',
    card: '#ffffff',
    line: '#d5dde9',
    onAccent: '#ffffff',
    deep: '#101a2e',
    onDeep: '#ffffff',
    onDeepSoft: '#a3b4cc',
  },
  radius: { sm: '4px', md: '8px', lg: '12px', pill: '999px' },
  surface: {
    shadow: '0 1px 2px rgba(15, 23, 41, .07), 0 2px 10px rgba(15, 23, 41, .06)',
    shadowLg: '0 6px 16px rgba(15, 23, 41, .10), 0 18px 44px rgba(15, 23, 41, .12)',
    border: '1px solid var(--ds-line)',
  },
  motif: { divider: 'angle', cardStyle: 'sheen', headingCase: 'none', headingTracking: '-0.02em', headStyle: 'line', texture: 'sheen', buttonStyle: 'sheen', heroLayout: 'centered', stepsStyle: 'track', ctaStyle: 'image', splitStyle: 'overlap', footerStyle: 'split', motion: 'smooth' },
  heroScrim: { top: 58, bottom: 84 },
  deepTint: 0.18,
};

const bold: PresetTokens = {
  label: 'Bold — high-saturation accent, heavy display face',
  fontFaces: [INTER, { family: 'Anton', weight: '400', file: 'anton-latin.woff2' }],
  fonts: {
    display: "'Anton', 'Haettenschweiler', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  colors: {
    ink: '#16151a',
    inkSoft: '#57535f',
    paper: '#fbf9f6',
    card: '#ffffff',
    line: '#e7e1d9',
    onAccent: '#ffffff',
    deep: '#16151a',
    onDeep: '#ffffff',
    onDeepSoft: '#a9a2b0',
  },
  radius: { sm: '8px', md: '14px', lg: '22px', pill: '999px' },
  surface: {
    shadow: '0 2px 0 rgba(22, 21, 26, .10)',
    shadowLg: '0 8px 0 rgba(22, 21, 26, .10), 0 18px 40px rgba(22, 21, 26, .12)',
    border: '2px solid var(--ds-ink)',
  },
  motif: { divider: 'curve', cardStyle: 'hard', headingCase: 'uppercase', headingTracking: '0.01em', headStyle: 'stamp', texture: 'dots', buttonStyle: 'hard', heroLayout: 'card', stepsStyle: 'numerals', ctaStyle: 'panel', splitStyle: 'stack', footerStyle: 'stacked', motion: 'snappy' },
  heroScrim: { top: 52, bottom: 80 },
  deepTint: 0.12,
};

/**
 * The one dark-surface preset. Every other preset paints dark ink on light paper and
 * reserves near-black for bands; `noir` inverts that — the page itself is near-black.
 *
 * It exists because a premium accent is often a *light* colour (brass, champagne,
 * bronze), and a light accent cannot clear WCAG AA as a fill on light paper: brass
 * #c6a46c manages 2.12:1 against stealth's #f3f3f4 where 3:1 is the floor, and no
 * amount of tuning fixes that — it is what "light on light" means. Against #0c0c0c the
 * same brass gives 8.32:1. So the surface has to move, not the accent.
 *
 * Structural motifs are stealth's, deliberately: the two presets are the same design
 * language at opposite polarity, and duplicating the motif choices is what makes that
 * legible. Typography is stealth's too.
 */
const noir: PresetTokens = {
  label: 'Noir — near-black surfaces, condensed display, built for a light accent',
  fontFaces: [INTER, { family: 'Oswald', weight: '500 700', file: 'oswald-latin.woff2' }],
  fonts: {
    display: "'Oswald', 'Arial Narrow', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  colors: {
    ink: '#fbfbfb',
    // 7.4:1 on paper — body copy, so it clears AA for normal text, not just large.
    inkSoft: '#a4a4ab',
    paper: '#0c0c0c',
    // Cards lift by one step rather than by shadow; see `surface` below.
    card: '#16161a',
    // Opaque, not the translucent #fbfbfb1a this is modelled on: --ds-line is read by
    // the contrast helpers, which parse 6-digit hex and would silently misread alpha.
    line: '#2a2a2e',
    // A light accent needs dark label text. Derived at render by pickOnAccent, which
    // will override this if a client's accent is dark enough to carry the light one.
    onAccent: '#0c0c0c',
    // Bands must read as *darker* than an already-dark page, so this bottoms out.
    deep: '#000000',
    onDeep: '#fbfbfb',
    onDeepSoft: '#9a9aa2',
  },
  radius: { sm: '0px', md: '2px', lg: '3px', pill: '2px' },
  surface: {
    // Drop shadows are invisible on a near-black page — a dark blur over dark paper
    // renders as nothing. Elevation comes from the card/paper step and a hairline
    // instead, and the "shadow" slots carry a faint inner light so the tokens still
    // mean something to the components that reference them.
    shadow: '0 0 0 1px rgba(251, 251, 251, .06)',
    shadowLg: '0 0 0 1px rgba(251, 251, 251, .08), 0 18px 48px rgba(0, 0, 0, .6)',
    border: '1px solid var(--ds-line)',
  },
  /*
   * Motifs are stealth's with one departure: `split` rather than `fullbleed`.
   *
   * On a light preset, full-bleed footage under a scrim is what separates the hero from
   * the page. On a near-black page there is nothing to separate — the scrim, the page
   * and dark footage are all the same value, so the hero loses its edges and the copy
   * looks like it is floating on the background. `split` gives the video a contained
   * panel with a real boundary, which is also how the client's own site frames it.
   */
  motif: { divider: 'angle', cardStyle: 'outline', headingCase: 'uppercase', headingTracking: '0.02em', headStyle: 'bar', texture: 'grid', buttonStyle: 'square', heroLayout: 'split', stepsStyle: 'ledger', ctaStyle: 'deep', splitStyle: 'wide', footerStyle: 'compact', motion: 'sharp' },
  /*
   * Lighter than every other preset, which is the opposite of what a dark theme
   * suggests. The scrim exists to stop bright footage washing out hero copy; on a
   * near-black page the footage a client picks is usually already dark, so a heavy
   * scrim buys no legibility (black over black is black) and costs the only thing
   * such footage has — its highlights. At 68/92 the rim light on JetSpa's jet was
   * knocked down to almost nothing.
   *
   * Still enough to protect white copy over a bright frame, which is the case that
   * would otherwise fail the contrast gate.
   */
  heroScrim: { top: 44, bottom: 76 },
  // Almost none. Tinting pure black toward a brass accent turns the bands muddy brown,
  // and the accent already has plenty of presence against these surfaces.
  deepTint: 0.03,
};

/** Duration / easing / travel per motion character. */
const MOTION = {
  calm:   { duration: '700ms', ease: 'cubic-bezier(.22,.61,.36,1)', distance: '14px' },
  sharp:  { duration: '320ms', ease: 'cubic-bezier(.2,0,0,1)',      distance: '8px'  },
  smooth: { duration: '560ms', ease: 'cubic-bezier(.4,0,.2,1)',     distance: '12px' },
  // Slight overshoot — the only preset that bounces.
  snappy: { duration: '420ms', ease: 'cubic-bezier(.34,1.32,.64,1)', distance: '18px' },
} as const;

const PRESET_MAP: Record<Preset, PresetTokens> = { fresh, stealth, chrome, bold, noir };

export function getPreset(name: Preset): PresetTokens {
  const preset = PRESET_MAP[name];
  if (!preset) {
    throw new Error(
      `Unknown theme.preset "${name}". Available: ${Object.keys(PRESET_MAP).join(', ')}.`,
    );
  }
  return preset;
}

export const ALL_PRESETS = Object.keys(PRESET_MAP) as Preset[];

/* ------------------------------------------------------------------ *
 * Contrast validation (spec §13 — every preset must pass WCAG AA with
 * any reasonable accentColor).
 * ------------------------------------------------------------------ */

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG relative contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/**
 * Moves a colour away from its backgrounds until it clears `min` against all of them.
 *
 * A mid-tone accent that looks right as a button fill is often just under AA as
 * small text — some saturated accents land just below AA on light paper. Deriving a
 * text-safe variant fixes that class of problem for every accent an agent might
 * pick, instead of hand-tuning each preset's palette against one client's colour.
 *
 * The direction depends on the surfaces, which is why this is not simply "darken":
 * on `noir`'s near-black paper, darkening an accent walks it *toward* the background
 * and the loop terminates at black having made contrast worse at every step. The
 * lightest background decides — if that is dark, the safe direction is up.
 */
export function deriveTextSafe(color: string, backgrounds: string[], min = AA_NORMAL): string {
  const lightestBg = Math.max(...backgrounds.map(luminance));
  const towardWhite = lightestBg < 0.18;
  let rgb = toRgb(color);
  for (let i = 0; i < 40; i++) {
    const hex = toHex(rgb);
    if (backgrounds.every((bg) => contrastRatio(hex, bg) >= min)) return hex;
    rgb = towardWhite
      ? ([
          rgb[0] + (255 - rgb[0]) * 0.06,
          rgb[1] + (255 - rgb[1]) * 0.06,
          rgb[2] + (255 - rgb[2]) * 0.06,
        ] as [number, number, number])
      : ([rgb[0] * 0.94, rgb[1] * 0.94, rgb[2] * 0.94] as [number, number, number]);
  }
  return towardWhite ? '#ffffff' : '#000000';
}

/**
 * Picks the label colour for text sitting on an accent fill.
 *
 * `onAccent` used to be a fixed per-preset value — always white, because every accent
 * in play was a mid-to-dark colour. That silently made light accents unusable: brass
 * carries white at 2.35:1, so `assertAccentContrast` rejected it and the advice
 * ("pick a darker accent") amounted to telling a client their brand colour was wrong.
 * The label is the part that should move, not the brand.
 *
 * The preset's own choice wins whenever it is legible, so no existing preset changes.
 */
export function pickOnAccent(accent: string, preferred: string): string {
  if (contrastRatio(preferred, accent) >= AA_NORMAL) return preferred;
  const [dark, light] = ['#0c0c0c', '#ffffff'];
  return contrastRatio(dark, accent) >= contrastRatio(light, accent) ? dark : light;
}

/** Linear blend of two hex colours; `t` is how much of `b` to mix in. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/**
 * Tints a preset's dark band toward the client accent for brand presence, backing
 * the tint off if it would push text on that band below AA. Derived rather than
 * authored, so it adds no decision for an agent to get wrong.
 */
export function deriveDeep(baseDeep: string, accent: string, tint: number, onDeep: string): string {
  for (let t = tint; t > 0; t -= 0.02) {
    const candidate = mixHex(baseDeep, accent, t);
    if (contrastRatio(onDeep, candidate) >= AA_NORMAL) return candidate;
  }
  return baseDeep;
}

/** Lightens a colour until it clears `min` — the dark-band counterpart. */
export function deriveOnDeepSafe(color: string, background: string, min = AA_LARGE): string {
  let rgb = toRgb(color);
  for (let i = 0; i < 40; i++) {
    const hex = toHex(rgb);
    if (contrastRatio(hex, background) >= min) return hex;
    rgb = [
      rgb[0] + (255 - rgb[0]) * 0.08,
      rgb[1] + (255 - rgb[1]) * 0.08,
      rgb[2] + (255 - rgb[2]) * 0.08,
    ] as [number, number, number];
  }
  return '#ffffff';
}

/**
 * Fails the build when the chosen accent cannot meet AA in the places the engine
 * actually paints it. Called from BaseLayout so every page render is validated.
 */
export function accentContrastIssues(
  name: Preset,
  accent: string,
): Array<{ what: string; ratio: number; min: number }> {
  const t = getPreset(name);
  // Accent *text* is not checked here: --ds-accent-ink / --ds-accent-on-deep are
  // derived to clear AA automatically. What remains is what derivation cannot fix —
  // the accent used as a large fill with onAccent text sitting on top of it.
  const checks: Array<{ what: string; a: string; b: string; min: number }> = [
    { what: 'button label on accent fill (--ds-on-accent vs accent)', a: pickOnAccent(accent, t.colors.onAccent), b: accent, min: AA_NORMAL },
    { what: 'accent fill against page background (accent vs --ds-paper)', a: accent, b: t.colors.paper, min: AA_LARGE },
  ];

  return checks
    .map(({ what, a, b, min }) => ({ what, min, ratio: contrastRatio(a, b) }))
    .filter((c) => c.ratio < c.min);
}

export function assertAccentContrast(name: Preset, accent: string): void {
  const failures = accentContrastIssues(name, accent);
  if (!failures.length) return;

  const lines = failures
    .map((f) => `  · ${f.what}: ${f.ratio.toFixed(2)}:1 — needs ${f.min}:1`)
    .join('\n');
  throw new Error(
    `theme.accentColor "${accent}" fails WCAG AA against the "${name}" preset:\n${lines}\n\n` +
      `Pick a different accent, or a preset whose surfaces suit this one — a light accent ` +
      `(brass, champagne, bronze) cannot clear AA as a fill on light paper and needs "noir".`,
  );
}

/* ------------------------------------------------------------------ */

/** Structural motifs, applied to <body> so components can respond to them. */
export function presetAttrs(name: Preset): Record<string, string> {
  const { motif } = getPreset(name);
  return {
    'data-preset': name,
    'data-divider': motif.divider,
    'data-card': motif.cardStyle,
    'data-head': motif.headStyle,
    'data-texture': motif.texture,
    'data-button': motif.buttonStyle,
    'data-hero': motif.heroLayout,
    'data-steps': motif.stepsStyle,
    'data-cta': motif.ctaStyle,
    'data-split': motif.splitStyle,
    'data-footer': motif.footerStyle,
    'data-motion': motif.motion,
  };
}

/** Renders preset + accent into @font-face rules and the custom properties. */
export function tokensToCss(name: Preset, accentColor: string): string {
  const t = getPreset(name);

  // Text-safe accents, derived per preset so any accent stays AA-legible.
  const accentInk = deriveTextSafe(accentColor, [t.colors.paper, t.colors.card]);

  // Dark bands carry a little of the client's accent — derived, then everything
  // that sits on them is re-derived against the result.
  const deep = deriveDeep(t.colors.deep, accentColor, t.deepTint, t.colors.onDeep);
  const onDeepSoft = deriveOnDeepSafe(t.colors.onDeepSoft, deep, AA_NORMAL);
  const accentOnDeep = deriveOnDeepSafe(accentColor, deep);

  const faces = t.fontFaces
    .map(
      (f) => `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};` +
        `font-display:swap;src:url('/fonts/${f.file}') format('woff2');unicode-range:${LATIN_RANGE};}`,
    )
    .join('\n');

  return `${faces}
:root{
--ds-font-display:${t.fonts.display};
--ds-font-body:${t.fonts.body};
--ds-ink:${t.colors.ink};
--ds-ink-soft:${t.colors.inkSoft};
--ds-paper:${t.colors.paper};
--ds-card:${t.colors.card};
--ds-line:${t.colors.line};
--ds-accent:${accentColor};
--ds-on-accent:${pickOnAccent(accentColor, t.colors.onAccent)};
--ds-accent-ink:${accentInk};
--ds-accent-on-deep:${accentOnDeep};
--ds-deep:${deep};
--ds-on-deep:${t.colors.onDeep};
--ds-on-deep-soft:${onDeepSoft};
--ds-radius-sm:${t.radius.sm};
--ds-radius-md:${t.radius.md};
--ds-radius-lg:${t.radius.lg};
--ds-radius-pill:${t.radius.pill};
--ds-shadow:${t.surface.shadow};
--ds-shadow-lg:${t.surface.shadowLg};
--ds-border:${t.surface.border};
--ds-heading-case:${t.motif.headingCase};
--ds-heading-tracking:${t.motif.headingTracking};
--ds-hero-scrim-top:${t.heroScrim.top}%;
--ds-hero-scrim-bottom:${t.heroScrim.bottom}%;
--ds-motion-duration:${MOTION[t.motif.motion].duration};
--ds-motion-ease:${MOTION[t.motif.motion].ease};
--ds-motion-distance:${MOTION[t.motif.motion].distance};
}`;
}
