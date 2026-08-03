/**
 * The SiteConfig contract — Layer 1 of the data model (spec §09).
 *
 * This file is ENGINE. It defines the shape; `client/site.config.ts` supplies the values.
 * Every field here is validated at build time, so a malformed payload fails the build
 * with a named error instead of shipping a broken page (core principle 3).
 */
import { z } from 'astro/zod';

/** Agents pick one of these. They never author raw token values (spec §13). */
export const PRESETS = ['stealth', 'fresh', 'chrome', 'bold', 'noir'] as const;
export type Preset = (typeof PRESETS)[number];

export const TEMPLATES = ['aviation-editorial'] as const;
export type Template = (typeof TEMPLATES)[number];

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'accentColor must be a 6-digit hex value, e.g. "#0e7c86"');

const usState = z.string().length(2).regex(/^[A-Z]{2}$/, 'state must be a 2-letter uppercase code');

/** A payload asset reference. Resolved (and existence-checked) by Img.astro. */
const imageRef = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
});

export const siteConfigSchema = z.object({
  template: z.enum(TEMPLATES),

  site: z.object({
    /** Absolute production origin, no trailing slash. Drives canonicals + sitemap. */
    url: z.url().refine((u) => !u.endsWith('/'), 'site.url must not have a trailing slash'),
  }),

  brand: z.object({
    name: z.string().min(1),
    /** Registered entity name for legal documents and structured business records. */
    legalName: z.string().min(1).optional(),
    /** Short positioning line used in the footer brand column and OG fallbacks. */
    tagline: z.string().min(1),
    /** Longer footer blurb (spec §04, brand column). */
    blurb: z.string().min(1),
    logoPath: z.string().min(1),
    /**
     * Closing sentence in the footer contact column. Optional — omitted, the footer
     * renders the bare "Serving {city}, {ST} and communities across {label}." line.
     * This exists because the sentence used to be hardcoded in Footer.astro and
     * asserted the business was mobile, which is not true of every client.
     */
    footerNote: z.string().min(1).optional(),
  }),

  contact: z.object({
    /** E.164 for tel: links. */
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'phone must be E.164, e.g. "+18775208638"'),
    /** Human-readable form used in visible copy. */
    phoneDisplay: z.string().min(1),
    email: z.email(),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: usState,
      zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    }),
  }),

  /** Powers the "we come to you" radius claims and LocalBusiness areaServed. */
  serviceArea: z.object({
    /** The city the business markets itself from — not always the mailing address city. */
    baseCity: z.string().min(1),
    baseState: usState,
    radiusMiles: z.number().int().positive(),
    /** e.g. "Northern Virginia and the greater DMV area" */
    label: z.string().min(1),
  }),

  hours: z
    .array(z.object({ days: z.string().min(1), hours: z.string().min(1) }))
    .min(1),

  socials: z.object({
    facebook: z.url().optional(),
    instagram: z.url().optional(),
    tiktok: z.url().optional(),
    youtube: z.url().optional(),
  }),

  ghl: z.object({
    /** GHL form/funnel URL used by the active template's quote page. */
    quoteUrl: z.url(),
    /** Optional "leave us a review" destination. */
    reviewUrl: z.url().optional(),
    /**
     * Embed the GHL form inline on /get-quote instead of linking out. Off by default:
     * a GHL iframe is unstyleable and shifts layout as it loads, so it is worth the
     * cost only where the form IS the page. Everywhere else keeps a link.
     */
    embed: z.boolean().default(false),
  }),

  tracking: z.object({
    gtmId: z.string().regex(/^GTM-[A-Z0-9]+$/, 'gtmId must look like "GTM-XXXXXXX"'),
  }),

  theme: z.object({
    preset: z.enum(PRESETS),
    /** The only raw design value an agent may set. Contrast-validated in Phase 4. */
    accentColor: hexColor,
  }),

  modules: z.object({
    /**
     * The announcement strip above the header: opening hours + service-area line +
     * socials. All derived from config, so it costs a client nothing to keep — but a
     * client whose hours or coverage story doesn't fit a one-liner turns it off here.
     */
    topBar: z.boolean().default(true),
    /** Home "How It Works" section. */
    howItWorks: z.boolean(),
    /** Optional credential badge on the About page (spec §11 decision 2). */
    credentialBadge: z
      .object({ image: z.string().min(1), alt: z.string().min(1), href: z.url().optional() })
      .optional(),
  }),

  seo: z.object({
    /** e.g. "Mobile Auto Detailing" — the {Category} token in every SEO formula. */
    category: z.string().min(1),
    /** e.g. "Northern Virginia" — the {region} token. */
    region: z.string().min(1),
  }),

  legal: z.object({
    /** Shown on /privacy-policy and /tos, e.g. "July 2026". */
    effectiveDate: z.string().min(1),
    /**
     * Where the legal text comes from.
     *
     * 'template' — generated by lib/legal.ts from this config. Reviewed once at the
     * Detailer Systems level and reused unchanged, which is the whole point.
     * 'client'   — the payload carries client/content/legal/*.md, which overrides the
     * template. That text has NOT been through Detailer Systems' legal review, and
     * this field records that rather than leaving it to be inferred from whether a
     * file happens to exist on disk.
     */
    source: z.enum(['template', 'client']).default('template'),
  }),

  /** Site-wide assets used by every page rather than authored per page. */
  defaults: z.object({
    /**
     * Fallback call-to-action headline for pages with no authored one of their own.
     * Lives here so no client's words sit in an engine file.
     */
    ctaHeadline: z.string().min(1),
    socialImage: imageRef,
    /**
     * The three-up card overlapping the hero. Optional and authored, because the
     * engine has no way to know what is true of a client: the first point used to be
     * hardcoded as "100% Mobile — we come to you", which is a claim, not a fact, and
     * was simply false for a business that works out of hangars.
     *
     * Omitted, the card falls back to the two points that ARE derivable from config
     * (coverage radius and opening hours) and asserts nothing.
     */
    heroProof: z
      .array(z.object({ label: z.string().min(1), detail: z.string().min(1) }))
      .max(3)
      .optional(),
    /**
     * Hero background video — the single hero asset. Every hero on every page uses
     * it, so a client supplies one video rather than a hero image per page.
     *
     * The poster is a still extracted from that same video. It carries LCP (a video
     * cannot), and it is what renders under `prefers-reduced-motion`, when autoplay
     * is blocked (iOS Low Power Mode), and before the video has buffered.
     */
    heroVideo: z.object({
      src: z.string().regex(/\.(webm|mp4)$/, 'heroVideo.src must be a .webm or .mp4 file'),
      /**
       * H.264 MP4 fallback. Strongly recommended: VP9-in-WebM support on Safari and
       * iOS is partial, so a WebM-only hero silently shows the poster to a large
       * share of a mobile-first audience.
       */
      fallbackSrc: z
        .string()
        .regex(/\.mp4$/, 'heroVideo.fallbackSrc must be a .mp4 file')
        .optional(),
      /**
       * Whether the clip repeats. True for continuous footage, which is most of it.
       *
       * Set false for a one-shot piece — a reveal, a title animation, anything with a
       * beginning and an end. Those restart visibly and read as a glitch on loop. A
       * non-looping video holds its last frame, so the hero still ends on an image.
       */
      loop: z.boolean().default(true),
      poster: imageRef,
    }),
  }),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

/**
 * What a payload may write, as opposed to what the engine reads back.
 *
 * These differ wherever the schema has a `.default()`: `ghl.embed` and
 * `legal.source` are optional to author and guaranteed present after parsing.
 * Typing the parameter as SiteConfig instead would force every payload to restate
 * every default.
 */
export type SiteConfigInput = z.input<typeof siteConfigSchema>;

/** Wraps a payload in validation so a bad config fails the build, loudly and by field. */
export function defineSiteConfig(config: SiteConfigInput): SiteConfig {
  const parsed = siteConfigSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid client/site.config.ts:\n${issues}`);
  }
  return parsed.data;
}
