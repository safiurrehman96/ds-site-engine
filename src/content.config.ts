/**
 * Layer 2 of the data model (spec §09) — the payload's content collections.
 *
 * All prose lives in frontmatter rather than the markdown body so that every
 * word an agent writes passes through zod. An empty body is expected.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 7 deprecates the `z` re-export from `astro:content`; `astro/zod` is the
// supported path and keeps the engine on a single zod instance (see config-schema.ts).
import { z } from 'astro/zod';

const BASE = './client/content';

/**
 * Every authored string passes through here.
 *
 * The refinement catches GHL merge fields that survived import. Client copy arrives
 * with `{{custom_values.business_phone}}` tokens throughout; scripts/import-notion.mjs
 * resolves them, but a token it does not know about would otherwise render literally
 * on a live page. Failing the build is the only place that gets caught reliably —
 * nothing downstream inspects prose for braces.
 */
const prose = z
  .string()
  .min(1)
  .refine(
    (v) => !v.includes('{{'),
    'unresolved merge field — every {{custom_values.*}} token must be resolved at import time',
  );

/** A heading + body pair. Most SplitSections in most recipes are one of these. */
const proseBlock = z.object({
  heading: prose,
  body: prose,
});

/** Meta description is hand-tuned per page; the ≤160 cap is enforced, not trusted. */
const metaDescription = prose.max(
  160,
  'metaDescription must be 160 characters or fewer (SEO formula, spec §10)',
);

const image = z.object({
  src: z.string().min(1),
  /** Pattern: "{subject} — {Brand} in {City}, {ST}" where sensible. */
  alt: prose,
});

/**
 * URL safety only. This deliberately does NOT encode what a page *is* — an earlier
 * version required area slugs to end in `-{st}`, which quietly assumed every service
 * area is a US city and rejected clients whose areas are airports, ports, or regions.
 * Cross-collection collisions are caught by assertUniqueSlugs() in lib/content.ts.
 */
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, hyphen-separated');

/**
 * Optional authored overrides for the two strings normally produced by the SEO
 * formulas in lib/seo.ts. Clients whose page generator already emits a tuned H1 and
 * title supply them here; everyone else gets the formula.
 */
const headingOverrides = {
  title: prose.optional(),
  h1: prose.optional(),
};

/**
 * A block on a variable-length page (About), which needs more than heading + body.
 *
 * The About recipe used to receive bare proseBlocks and could therefore only render
 * bare text — every block after the first came out as the same centred column, no
 * matter what SplitSection was capable of. The engine's compositions were reachable
 * from the component and unreachable from the payload.
 *
 * What is added here is *content*, not design: whether a block has a photo, and
 * whether it closes on an action. The recipe still decides the composition from
 * those facts (spec §13 — variants are earned, not fiddled with per page), so a
 * payload cannot art-direct its own page.
 */
const pageBlock = proseBlock.extend({
  image: image.optional(),
  cta: z
    .object({
      label: prose,
      href: z.string().min(1),
    })
    .optional(),
});

/** Before/after pair. Two images per instance — mind the asset budget. */
const beforeAfter = z
  .object({
    before: image,
    after: image,
    beforeLabel: prose.default('Before'),
    afterLabel: prose.default('After'),
    caption: prose.optional(),
  })
  .optional();

const services = defineCollection({
  loader: glob({ base: `${BASE}/services`, pattern: '**/*.md' }),
  schema: z.object({
    name: prose,
    /** Must match the filename and the live URL: /{slug} */
    slug,
    order: z.number().int().nonnegative(),
    /** One-liner reused by ServicesGrid on home, about, and every area page. */
    shortDescription: prose,
    metaDescription,
    ...headingOverrides,

    heroImage: image,
    /** Hero body copy. The H1 comes from `h1` when set, else formula (spec §10). */
    heroIntro: prose,

    /** Optional before/after proof, rendered between the process steps and add-ons. */
    beforeAfter,

    intro: proseBlock,
    /** "What Is {Service}" educational block. Absent on Kleen's simpler pages. */
    explainer: proseBlock.optional(),

    /**
     * Product tiers, where the client sells them. Optional: plenty of businesses
     * quote per job and publish no tiers at all, and inventing package cards to
     * satisfy a schema would be inventing a product structure.
     */
    packages: z
      .array(
        z.object({
          name: prose,
          /**
           * The second-line subtitle above package body copy
           * (e.g. "Clean From Every Angle"). Schema extension — see PHASE-0-NOTES.md.
           */
          tagline: prose,
          /** e.g. "2–3 years" — only where the client actually states a duration. */
          durationBadge: prose.optional(),
          image: image.optional(),
          body: prose,
        }),
      )
      .min(1)
      .optional(),

    processHeading: prose,
    processSteps: z
      .array(
        z.object({
          /** Optional: Kleen's service-page steps are single sentences with no lead-in. */
          title: prose.optional(),
          body: prose,
        }),
      )
      .min(1),
    /** Trailing requirement note under the steps (water/power access, etc.). */
    processNote: prose.optional(),

    /** Optional for the same reason as `packages`. */
    addons: z
      .array(
        z.object({
          name: prose,
          image: image.optional(),
          body: prose,
        }),
      )
      .min(1)
      .optional(),

    /**
     * Internal-linking block ("We Detail Every Vehicle Type"). Schema extension —
     * Kleen uses this slot where the spec's San Mob template uses `whyItMatters`.
     */
    crossSell: proseBlock,
    /** "Why {Service} Matters" local-conditions block. Optional; absent on Kleen. */
    whyItMatters: proseBlock.optional(),

    faqs: z.array(z.object({ q: prose, a: prose })).min(1),

    /** Closing CTABanner headline. Service-specific. */
    ctaHeadline: prose,
  }),
});

const areas = defineCollection({
  loader: glob({ base: `${BASE}/areas`, pattern: '**/*.md' }),
  schema: z.object({
    /** Display name. A city ("Ashburn"), but equally an airport or a region. */
    name: prose,
    slug,
    /**
     * Optional. Set for US-city areas, where every label reads "{name}, {ST}" and the
     * LocalBusiness areaServed entry is a City. Omit for areas that are not cities —
     * an airport is a Place, and "Teterboro Airport (KTEB), NJ" is not how anyone
     * writes it. Read through areaLabel() in lib/content.ts, never inline.
     */
    state: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/)
      .optional(),
    /** Compact label for nav and tiles where the full name is too long ("KTEB"). */
    shortName: prose.optional(),
    order: z.number().int().nonnegative(),
    /** Marks the home base; rendered as "HQ" in nav. */
    isHeadquarters: z.boolean().default(false),
    metaDescription,
    ...headingOverrides,

    /**
     * Optional tile image for AreasGrid's `tiles` variant. Most clients have no
     * per-city photography, so this falls back to the hero poster when unset —
     * but the variant only earns its place when the images actually differ.
     */
    image: image.optional(),

    heroIntro: prose,
    /** Intro above the ServicesGrid on this page. Authored — the engine has no
     *  business asserting that services "come to you". */
    servicesIntro: prose,

    /** "Why {Area} Residents Choose Mobile Detailing" — the hyper-local block. */
    localCopy: proseBlock,
    /**
     * Second local block, for clients whose area pages carry genuinely page-specific
     * detail (an airport's FBOs, weather, and scheduling constraints) beyond the
     * "why here" pitch. Rendered after localCopy.
     */
    localDetail: proseBlock.optional(),
    /** "Why {Brand} for {Area}" trust block. */
    whyUs: proseBlock,

    beforeAfter,

    ctaHeadline: prose,
  }),
});

const home = defineCollection({
  loader: glob({ base: BASE, pattern: 'home.md' }),
  schema: z.object({
    metaDescription,
    /** Home is the one page whose H1 is authored, not formula-generated. */
    heroHeadline: prose,
    /** Optional hero body. Kleen's home hero is headline-only. */
    heroIntro: prose.optional(),

    intro: proseBlock,
    /** Image beside the intro block. */
    introImage: image,
    trust: proseBlock,
    /** Founder/differentiator block. Optional — Kleen keeps this on /about only. */
    about: proseBlock.optional(),

    howItWorks: z
      .object({
        heading: prose,
        intro: prose.optional(),
        steps: z.array(z.object({ title: prose, body: prose })).min(1),
      })
      .optional(),

    /** Intro above the home ServicesGrid. Authored, for the same reason as areas. */
    servicesIntro: prose,
    areasIntro: prose,
    ctaHeadline: prose,
  }),
});

const about = defineCollection({
  loader: glob({ base: BASE, pattern: 'about.md' }),
  schema: z.object({
    metaDescription,
    heroImage: image,
    heroHeadline: prose,
    /**
     * Ordered content blocks. About is the one page with a variable block count,
     * which is why each block carries its own optional photo and CTA — a recipe that
     * does not know whether it will be handed two blocks or nine cannot hand-compose
     * the page, so the variety has to come from what each block brings with it.
     */
    blocks: z.array(pageBlock).min(1),
    ctaHeadline: prose,
  }),
});

const faqs = defineCollection({
  loader: glob({ base: BASE, pattern: 'faqs.md' }),
  schema: z.object({
    metaDescription,
    heroHeadline: prose,
    heroIntro: prose,
    /** Site-level FAQs are grouped; service-page FAQs are flat. */
    groups: z
      .array(
        z.object({
          heading: prose,
          faqs: z.array(z.object({ q: prose, a: prose })).min(1),
        }),
      )
      .min(1),
    ctaHeadline: prose,
    /** Sub-headline under the closing CTA. Shown only when no reviewUrl is set. */
    ctaBody: prose.optional(),
  }),
});

/**
 * Recipe D — /booking. The calendar list itself comes from ghl.bookingUrls; only the
 * words around it live here. Kleen's chooser is by vehicle type, JetSpa's is by
 * aircraft class, so none of this copy can sit in the route.
 */
const booking = defineCollection({
  loader: glob({ base: BASE, pattern: 'booking.md' }),
  schema: z.object({
    metaDescription,
    title: prose,
    heroHeadline: prose,
    heroIntro: prose,
    /** "Need Help Choosing a Service?" block above the closing CTA. */
    helpBlock: proseBlock,
    ctaHeadline: prose,
  }),
});

/** Recipe D — /get-quote. Links out (or embeds) the GHL form; copy is authored. */
const getQuote = defineCollection({
  loader: glob({ base: BASE, pattern: 'get-quote.md' }),
  schema: z.object({
    metaDescription,
    title: prose,
    heroHeadline: prose,
    heroIntro: prose,
    /** Heading above the service link list. */
    servicesHeading: prose,
    /** Heading on the contact/hours sidebar panel. */
    panelHeading: prose,
    ctaHeadline: prose,
  }),
});

/**
 * Recipe F — /booking-confirmed. Post-booking confirmation and preparation steps.
 * Noindexed and excluded from the sitemap: it is a conversion endpoint, not a
 * landing page, and indexing it both wastes crawl budget and pollutes goal tracking.
 */
const bookingConfirmed = defineCollection({
  loader: glob({ base: BASE, pattern: 'booking-confirmed.md' }),
  schema: z.object({
    metaDescription,
    title: prose,
    heroHeadline: prose,
    heroIntro: prose,
    /** Ordered SplitSections — same variable-count shape as About. */
    blocks: z.array(proseBlock).min(1),
    ctaHeadline: prose,
  }),
});

/**
 * Recipe E — authored legal override.
 *
 * Optional by design. Absent, /privacy-policy and /tos render the shared Detailer
 * Systems template from lib/legal.ts, which is the point of the template: reviewed
 * once, reused unchanged. Present, the payload wins — some clients carry
 * industry-specific liability, warranty, or insurance clauses the template cannot
 * express. Mirrors the LegalDocument interface in lib/legal.ts.
 *
 * Set legal.source: 'client' in site.config.ts when using these, so it stays visible
 * that the text has not been through Detailer Systems' legal review.
 */
const legal = defineCollection({
  loader: glob({ base: `${BASE}/legal`, pattern: '**/*.md' }),
  schema: z.object({
    title: prose,
    metaDescription,
    intro: z.array(prose).min(1),
    sections: z
      .array(
        z.object({
          heading: prose,
          body: z.array(prose).optional(),
          bullets: z.array(z.object({ term: prose.optional(), text: prose })).optional(),
        }),
      )
      .min(1),
    /** Closing contact block. Falls back to a config-derived one when omitted. */
    contact: z.object({ heading: prose, intro: prose }).optional(),
    ctaHeadline: prose.optional(),
  }),
});

export const collections = {
  services,
  areas,
  home,
  about,
  faqs,
  booking,
  getQuote,
  bookingConfirmed,
  legal,
};
