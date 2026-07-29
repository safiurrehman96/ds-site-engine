/**
 * THE INTAKE CONTRACT — everything a new client site needs, in one file.
 *
 * One `intake.json` per client, at clients/<slug>/source/intake.json. It is the single
 * source of truth for three things that were previously three separate inputs:
 *
 *   1. site.config.ts          — the facts the engine validates at build time
 *   2. the merge-field token map — what {{custom_values.*}} resolves to on import
 *   3. the page inventory       — which services and areas exist, in what order
 *
 * WHY NULLS ARE ALLOWED
 * Onboarding never arrives complete. A field whose value is not yet known is `null`,
 * never a guess and never a plausible-looking placeholder — an invented phone number
 * that passes validation is far worse than a missing one that fails it. `null` is
 * carried into the payload as a TODO(fact-needed) marker, so the engine's own zod
 * validation refuses to build until a human supplies it. Nothing ships half-known.
 *
 * Run `node scripts/check-intake.mjs <slug>` to validate one and list what is missing.
 */
import { z } from 'astro/zod';

/** A value that may legitimately be unknown at intake time. */
const pending = (schema) => schema.nullable();

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase and hyphen-separated');

const url = z.string().url();
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex colour');

/** Matches src/config-schema.ts so intake cannot accept what the engine will reject. */
const usState = z.string().length(2).regex(/^[A-Z]{2}$/);

const image = z.object({
  /** Filename as it will sit in clients/<slug>/assets/. */
  file: z.string().min(1),
  /** Pattern: "{subject} — {Brand} in {City}, {ST}" where sensible. */
  alt: z.string().min(1),
});

export const intakeSchema = z.object({
  /** Directory name under clients/. Also the default subdomain for staging. */
  slug,

  business: z.object({
    /** Trading name, used site-wide. */
    name: z.string().min(1),
    /** Entity name for legal pages, when it differs from the trading name. */
    legalName: z.string().nullish(),
    /**
     * Person behind the business. Resolves {{custom_values.business_owner}} and is
     * the only place a founder story may draw a name from.
     */
    owner: pending(z.string().min(1)),
    tagline: pending(z.string().min(1)),
    /** Longer footer blurb. */
    blurb: pending(z.string().min(1)),
    /** Production origin, no trailing slash. */
    websiteUrl: pending(url),
    /** The {Category} token in every SEO formula, e.g. "Aircraft Detailing". */
    category: z.string().min(1),
    /** The {region} token, e.g. "the Northeast". */
    region: z.string().min(1),
    /**
     * Closing sentence in the footer contact column. Optional — the engine renders
     * the bare "Serving {city}, {ST}..." line when absent. Must not assert anything
     * untrue of this client (the old hardcoded one claimed every business was mobile).
     */
    footerNote: z.string().nullish(),
  }),

  contact: z.object({
    /** E.164, for tel: links. */
    phone: pending(z.string().regex(/^\+[1-9]\d{7,14}$/, 'must be E.164, e.g. "+12015550100"')),
    /** Human-readable form used in visible copy. */
    phoneDisplay: pending(z.string().min(1)),
    email: pending(z.string().email()),
    /**
     * Required by the engine for LocalBusiness JSON-LD. A client working out of
     * hangars or without a public premises still needs one — use the registered
     * business address rather than omitting it.
     */
    address: pending(
      z.object({
        street: z.string().min(1),
        city: z.string().min(1),
        state: usState,
        zip: z.string().regex(/^\d{5}(-\d{4})?$/),
      }),
    ),
  }),

  serviceArea: z.object({
    /** The city the business markets from — not always the mailing address city. */
    baseCity: pending(z.string().min(1)),
    baseState: pending(usState),
    /** Drives the GeoCircle radius in JSON-LD. */
    radiusMiles: pending(z.number().int().positive()),
    /** Prose form, e.g. "the Northeast corridor". Resolves service_location. */
    label: pending(z.string().min(1)),
  }),

  hours: pending(z.array(z.object({ days: z.string().min(1), hours: z.string().min(1) })).min(1)),

  socials: z.object({
    facebook: z.string().url().nullish(),
    instagram: z.string().url().nullish(),
    tiktok: z.string().url().nullish(),
    youtube: z.string().url().nullish(),
    /** "Leave us a review" destination. Changes what the FAQs CTA offers. */
    reviewUrl: z.string().url().nullish(),
  }),

  ghl: z.object({
    /**
     * One calendar per bookable class. The chooser on /booking renders these in
     * order, so the labels are customer-facing copy, not internal names.
     *
     * The url is pending per entry, not for the list as a whole: the classes are
     * settled during onboarding, while the calendars are built in GHL afterwards.
     */
    bookingUrls: pending(z.array(z.object({ label: z.string().min(1), url: pending(url) })).min(1)),
    quoteUrl: pending(url),
    /** Embed the form inline on /booking and /get-quote rather than linking out. */
    embed: z.boolean().default(false),
  }),

  tracking: z.object({
    gtmId: pending(z.string().regex(/^GTM-[A-Z0-9]+$/, 'must look like "GTM-XXXXXXX"')),
  }),

  theme: z.object({
    preset: z.enum(['stealth', 'fresh', 'chrome', 'bold']),
    /** The only raw design value anyone may set. Contrast-validated at build. */
    accentColor: hex,
  }),

  modules: z.object({
    /** Home "How It Works" steps. */
    howItWorks: z.boolean().default(true),
    credentialBadge: z
      .object({ image: z.string().min(1), alt: z.string().min(1), href: z.string().url().nullish() })
      .nullish(),
    /** Set to show a nav link out to a blog still hosted elsewhere. */
    blogUrl: z.string().url().nullish(),
  }),

  legal: z.object({
    /** e.g. "July 2026". */
    effectiveDate: pending(z.string().min(1)),
    /**
     * 'template' — generated from these facts, reviewed once at the Detailer Systems
     * level. 'client' — the client supplied their own text, which has NOT been through
     * that review. Recording which is deliberate; it is not inferrable later.
     */
    source: z.enum(['template', 'client']).default('template'),
    /** Governing-law state, where the client's own terms name one. */
    governingState: z.string().nullish(),
  }),

  /**
   * The page inventory. Prose does not live here — it arrives via the content export
   * and is authored into collection files. This is only what exists and in what order.
   */
  pages: z.object({
    services: z
      .array(
        z.object({
          name: z.string().min(1),
          slug,
          order: z.number().int().nonnegative(),
          /** One-liner reused by every ServicesGrid. */
          shortDescription: z.string().nullish(),
          /** Marks aircraft/vehicle-class pages, which read as services but sell a segment. */
          kind: z.enum(['service', 'segment']).default('service'),
        }),
      )
      .min(1),

    areas: z
      .array(
        z.object({
          name: z.string().min(1),
          slug,
          order: z.number().int().nonnegative(),
          /**
           * Only for areas that are US cities. Omit for airports, ports, or regions —
           * it drives both the "{name}, {ST}" label and City vs Place in JSON-LD.
           */
          state: usState.nullish(),
          /** Compact label for nav and tiles, e.g. "KTEB". */
          shortName: z.string().nullish(),
          isHeadquarters: z.boolean().default(false),
        }),
      )
      .min(1),
  }),

  /**
   * Site-level assets. Per-page images follow the convention
   * service-{slug}.jpg / package-{slug}.jpg and are declared in the payload markdown.
   *
   * Budgets are enforced at build: 1536KB hero video, 600KB per image.
   */
  assets: z.object({
    logo: pending(z.object({ file: z.string().min(1) })),
    /**
     * Video is the standard for every hero; the poster is a frame from it and is what
     * carries LCP, renders before buffering, and shows when autoplay is blocked.
     */
    heroVideo: pending(
      z.object({
        file: z.string().regex(/\.(webm|mp4)$/),
        /** H.264 MP4 fallback — without it, Safari and iOS see only the poster. */
        fallbackFile: z.string().regex(/\.mp4$/).nullish(),
        poster: image,
      }),
    ),
    socialImage: pending(image),
    /** Photo beside the home intro block. */
    introImage: pending(image),
    /**
     * Where before/after proof exists. Keyed by service slug; the pair is authored
     * into that service's markdown.
     */
    beforeAfter: z
      .array(z.object({ serviceSlug: slug, before: image, after: image, caption: z.string().nullish() }))
      .default([]),
  }),

  /**
   * Merge-field values the content export references. Derived automatically from the
   * facts above; this map only covers client-specific custom values the standard set
   * does not, and overrides a derived value where they disagree.
   */
  tokens: z.record(z.string()).default({}),

  /** 301s for URLs that change when migrating off the client's old site. */
  redirects: z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1), status: z.number().default(301) }))
    .default([]),

  source: z.object({
    /** How the prose arrived. 'notion-export' is what scripts/import-notion.mjs reads. */
    type: z.enum(['notion-export', 'manual', 'scrape']),
    /** Directory holding the export, relative to clients/<slug>/. */
    path: z.string().nullish(),
  }),

  /** Anything a human needs to know that no field above captures. */
  notes: z.array(z.string()).default([]),
});

/**
 * Fields the engine's own schema (src/config-schema.ts) requires. Null here means the
 * payload cannot build — not a style preference, a hard stop.
 *
 * `*` matches an array index. Kept as an explicit list rather than inferred from the
 * zod tree because "may be null during onboarding" and "is optional forever" are
 * different ideas that happen to share a representation: an airport has no state and
 * never will, while a phone number is simply not known yet.
 */
export const REQUIRED_BEFORE_BUILD = [
  'business.owner',
  'business.tagline',
  'business.blurb',
  'business.websiteUrl',
  'contact.phone',
  'contact.phoneDisplay',
  'contact.email',
  'contact.address',
  'serviceArea.baseCity',
  'serviceArea.baseState',
  'serviceArea.radiusMiles',
  'serviceArea.label',
  'hours',
  'ghl.bookingUrls',
  'ghl.bookingUrls.*.url',
  'ghl.quoteUrl',
  // The engine requires a GTM container; there is no "no analytics" path today.
  'tracking.gtmId',
  'legal.effectiveDate',
  'assets.logo',
  'assets.heroVideo',
  'assets.socialImage',
  'assets.introImage',
];

/** Wanted before the site goes live, but the build does not depend on them. */
export const REQUIRED_BEFORE_LAUNCH = ['socials.reviewUrl', 'redirects'];

const matches = (path, pattern) => {
  const p = path.split('.');
  const q = pattern.split('.');
  return p.length === q.length && q.every((seg, i) => seg === '*' || seg === p[i]);
};

/** Every null in the intake, by dotted path (array indices included). */
function nullPaths(value, path = []) {
  if (value === null) return [path.join('.')];
  if (Array.isArray(value)) return value.flatMap((v, i) => nullPaths(v, [...path, String(i)]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => nullPaths(v, [...path, k]));
  }
  return [];
}

/**
 * Splits outstanding facts by consequence: what blocks the build, what blocks launch,
 * and what is simply an optional field left empty on purpose.
 */
export function classifyPending(intake) {
  const blocking = [];
  const launch = [];
  const optional = [];

  for (const p of nullPaths(intake)) {
    if (REQUIRED_BEFORE_BUILD.some((r) => matches(p, r))) blocking.push(p);
    else if (REQUIRED_BEFORE_LAUNCH.some((r) => matches(p, r))) launch.push(p);
    else optional.push(p);
  }

  return { blocking, launch, optional };
}

/**
 * The standard GHL merge fields, derived from intake facts.
 *
 * Two maps, because business_phone differs by position: the display form belongs in a
 * sentence, the E.164 form belongs in a tel: link, and a single blind replace gets one
 * of them wrong every time. GHL's own field names carry a triple-s typo on the social
 * fields, and exports contain both spellings.
 */
export function tokenMaps(intake) {
  const { business, contact, serviceArea, socials, hours } = intake;
  const hoursLine = hours?.map((h) => `${h.days}: ${h.hours}`).join(', ') ?? null;

  const prose = {
    business_name: business.name,
    business_owner: business.owner,
    business_phone: contact.phoneDisplay ?? contact.phone,
    business_email: contact.email,
    business_website_url: business.websiteUrl,
    business_hours: hoursLine,
    service_location: serviceArea.label,
    quote_page_link: '/get-quote',
    gmb_review_link: socials.reviewUrl,
    businesss_facebook: socials.facebook,
    business_facebook: socials.facebook,
    businesss_instagram: socials.instagram,
    business_instagram: socials.instagram,
    businesss_tiktok: socials.tiktok,
    business_tiktok: socials.tiktok,
    businesss_youtube: socials.youtube,
    business_youtube: socials.youtube,
    social_sharing: intake.assets.socialImage ? `./assets/${intake.assets.socialImage.file}` : null,
    ...intake.tokens,
  };

  const href = { ...prose, business_phone: contact.phone ?? contact.phoneDisplay };

  const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
  return { prose: drop(prose), href: drop(href) };
}

export default intakeSchema;
