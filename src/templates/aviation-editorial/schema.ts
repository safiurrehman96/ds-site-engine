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
  cta: z.object({
    eyebrow: prose,
    heading: prose,
    body: prose,
    media: mediaSlot,
    availability: prose,
  }),
});

export type AviationHome = z.infer<typeof aviationHomeSchema>;
