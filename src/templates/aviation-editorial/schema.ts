import { z } from 'astro/zod';

const prose = z
  .string()
  .min(1)
  .refine((value) => !value.includes('{{'), 'unresolved merge field');

const image = z.object({
  src: z.string().min(1),
  alt: prose,
});

const linkedItem = z.object({
  slug: z.string().min(1),
  summary: prose,
  imageLabel: prose,
});

const mediaSlot = z.object({
  label: prose,
  image: image.optional(),
});

const ctaSchema = z.object({
  eyebrow: prose,
  heading: prose,
  body: prose,
  media: mediaSlot,
  availability: prose.optional(),
  secondaryAction: z.enum(['booking', 'phone']).default('booking'),
  secondaryLabel: prose.optional(),
  details: z
    .array(
      z.object({
        label: prose,
        kind: z.enum(['phone', 'email', 'text']),
        value: prose.optional(),
      }),
    )
    .max(3)
    .default([]),
});

export const aviationHomeSchema = z.object({
  metaDescription: prose.max(160),
  chrome: z.object({
    stationLabel: prose,
    emergencyLabel: prose,
    mobileCallLabel: prose,
  }),
  hero: z.object({
    eyebrow: prose,
    headline: prose,
    subheading: prose,
    body: prose,
    mediaCaption: prose,
    mediaStatus: prose,
  }),
  credentials: z
    .array(
      z.object({
        label: prose,
        summary: prose,
      }),
    )
    .min(3)
    .max(5),
  introduction: z.object({
    eyebrow: prose,
    metadata: z.array(prose).min(1),
    heading: prose,
    body: z.array(prose).min(1).max(3),
    stats: z.array(z.object({ value: prose, label: prose })).min(2).max(4),
    primaryMedia: mediaSlot,
    detailMedia: z.array(mediaSlot).max(2).default([]),
  }),
  mediaBand: z.array(mediaSlot).min(2).max(3),
  services: z.object({
    eyebrow: prose,
    heading: prose,
    featured: linkedItem.extend({
      label: prose,
      status: prose,
      specs: z.array(z.object({ label: prose, value: prose })).min(2).max(5),
    }),
    standardLabel: prose,
    standardMeta: prose,
    standard: z.array(linkedItem).min(1),
    classLabel: prose,
    classMeta: prose,
    aircraftClasses: z
      .array(
        linkedItem.extend({
          category: prose,
          scope: prose,
        }),
      )
      .min(1),
    emergency: linkedItem.extend({
      status: prose,
    }),
  }),
  differentiation: z.object({
    eyebrow: prose,
    heading: prose,
    intro: prose,
    media: mediaSlot,
    issuedLabel: prose,
    issuedItems: z.array(prose).min(1),
    items: z
      .array(
        z.object({
          label: prose,
          title: prose,
          body: prose,
        }),
      )
      .min(3),
  }),
  process: z.object({
    eyebrow: prose,
    heading: prose,
    intro: prose,
    steps: z
      .array(
        z.object({
          title: prose,
          body: prose,
          facts: z.array(z.object({ label: prose, value: prose })).min(1).max(3),
        }),
      )
      .min(3)
      .max(6),
  }),
  coverage: z.object({
    eyebrow: prose,
    heading: prose,
    intro: prose,
    map: mediaSlot,
    airports: z
      .array(
        z.object({
          slug: z.string().min(1),
          description: prose,
          serviceMode: prose,
          serviceNote: prose,
          status: z.enum(['badged', 'escorted']),
        }),
      )
      .min(1),
    note: prose,
  }),
  proof: z.object({
    gallery: z.array(mediaSlot).min(1).max(5),
    quote: prose,
    attribution: prose,
    audiences: z.array(z.object({ label: prose, code: prose })).min(1),
  }),
  cta: ctaSchema,
});

export type AviationHome = z.infer<typeof aviationHomeSchema>;

export const aviationAboutSchema = z.object({
  metaDescription: prose.max(160),
  masthead: z.object({
    eyebrow: prose,
    headline: prose,
    lead: prose,
    body: prose,
    stats: z.array(z.object({ label: prose, value: prose })).min(3).max(6),
    media: mediaSlot,
  }),
  story: z.object({
    eyebrow: prose,
    metadata: z.array(prose).min(1),
    heading: prose,
    body: z.array(prose).min(1).max(3),
    services: z.array(z.object({ label: prose, value: prose })).min(1),
    media: z.array(mediaSlot).min(1).max(3),
  }),
  coverage: z.object({
    eyebrow: prose,
    heading: prose,
    intro: prose,
    emergencyLabel: prose,
    emergencyBody: prose,
    airports: z
      .array(
        z.object({
          slug: z.string().min(1),
          description: prose,
          status: z.enum(['badged', 'escorted']),
        }),
      )
      .min(1),
    map: mediaSlot,
  }),
  liability: z.object({
    eyebrow: prose,
    heading: prose,
    lead: prose,
    body: z.array(prose).min(1).max(3),
    principles: z.array(z.object({ label: prose, body: prose })).min(1),
    stats: z.array(z.object({ value: prose, label: prose })).min(2).max(4),
  }),
  founder: z.object({
    eyebrow: prose,
    heading: prose,
    body: z.array(prose).min(1).max(3),
    media: mediaSlot,
    stats: z.array(z.object({ value: prose, label: prose })).min(2).max(4),
  }),
  expectations: z.object({
    eyebrow: prose,
    heading: prose,
    items: z
      .array(z.object({ label: prose, title: prose, body: prose }))
      .min(2)
      .max(5),
    quote: prose,
    links: z.array(z.object({ label: prose, href: z.string().min(1) })).min(1).max(5),
  }),
  cta: ctaSchema,
});

export type AviationAbout = z.infer<typeof aviationAboutSchema>;

export const aviationFaqSchema = z.object({
  metaDescription: prose.max(160),
  masthead: z.object({
    eyebrow: prose,
    headline: prose,
    lead: prose,
    body: prose,
    fastAnswers: z.array(z.object({ label: prose, value: prose })).min(2).max(6),
  }),
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        heading: prose,
        shortHeading: prose.optional(),
        status: prose.optional(),
        faqs: z
          .array(
            z.object({
              q: prose,
              a: prose,
              layout: z.enum(['cards', 'rows']).optional(),
              items: z.array(z.object({ label: prose, value: prose })).min(1).optional(),
              metrics: z.array(z.object({ value: prose, label: prose })).min(1).max(3).optional(),
              link: z.object({ label: prose, href: z.string().min(1) }).optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  cadence: z.object({
    eyebrow: prose,
    note: prose,
    rows: z
      .array(
        z.object({
          aircraftClass: prose,
          fullDetail: prose,
          betweenServices: prose,
        }),
      )
      .min(1),
  }),
  cta: ctaSchema,
});

export type AviationFaq = z.infer<typeof aviationFaqSchema>;

export const aviationAirportSchema = z.object({
  officialName: prose,
  locationLabel: prose,
  iata: prose,
  access: z.enum(['badged', 'escorted']),
  heroSummary: prose,
  facts: z.array(z.object({ label: prose, value: prose })).min(3).max(4),
  bandNote: prose,
  conditions: z
    .array(
      z.object({
        label: prose,
        title: prose,
        body: prose,
      }),
    )
    .min(3)
    .max(5),
  referenceImpacts: z.array(prose).min(3).max(5),
  teaser: prose,
});

export type AviationAirport = z.infer<typeof aviationAirportSchema>;
