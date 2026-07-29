/**
 * The SEO formulas from spec §10, in one place. Recipes never build these strings
 * themselves — if a page needs a title, it comes from here.
 */
import type { SiteConfig } from '../config-schema';

/**
 * `{Service|Category} in {City}, {ST} | {Brand}`
 *
 * `state` is optional: areas that are not US cities (airports, ports, regions) carry
 * no state, and the formula drops the segment rather than emitting a dangling comma.
 * Pages whose payload supplies an authored `title` never reach this.
 */
export function buildTitle(
  config: SiteConfig,
  subject: string,
  place: string,
  state?: string,
): string {
  return `${buildH1(subject, place, state)} | ${config.brand.name}`;
}

/**
 * Home targets the region, not the base city.
 *
 * Deviation from the spec §10 formula, deliberately: applying the city formula to
 * home produces a title identical to the HQ area page (`/` and `/sterling-va` both
 * became "Mobile Auto Detailing in Sterling, VA | Kleen Car Care"), so the two pages
 * compete for the same query. The live GHL site has this same collision. Pointing
 * home at the region keeps one page per target term.
 */
export function buildHomeTitle(config: SiteConfig): string {
  return `${config.seo.category} in ${config.seo.region} | ${config.brand.name}`;
}

/** `{Service|Category} in {City/Area}[, {ST}]` */
export function buildH1(subject: string, place: string, state?: string): string {
  return `${subject} in ${place}${state ? `, ${state}` : ''}`;
}

/**
 * Self-referencing canonical.
 *
 * Astro's default `directory` build format writes `/about/index.html`, which servers
 * hand out at `/about/`, and @astrojs/sitemap lists the same trailing-slash form.
 * Canonicals must match that exactly or Google sees `/about` and `/about/` as two URLs.
 */
export function canonical(config: SiteConfig, pathname: string): string {
  const slug = pathname.replace(/^\/|\/$/g, '');
  return slug ? `${config.site.url}/${slug}/` : `${config.site.url}/`;
}

/**
 * LocalBusiness from the footer NAP (spec §10). Emitted on every page.
 * `areaServed` is fed from the areas collection so adding a city updates the schema.
 */
export function localBusinessJsonLd(
  config: SiteConfig,
  areas: Array<{ name: string; state?: string }>,
): Record<string, unknown> {
  const { brand, contact, serviceArea, hours, socials, seo } = config;
  const sameAs = Object.values(socials).filter((u): u is string => Boolean(u));

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${config.site.url}/#business`,
    name: brand.name,
    description: brand.blurb,
    url: config.site.url,
    telephone: contact.phone,
    email: contact.email,
    image: `${config.site.url}${brand.logoPath.replace(/^\.\//, '/')}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: contact.address.street,
      addressLocality: contact.address.city,
      addressRegion: contact.address.state,
      postalCode: contact.address.zip,
      addressCountry: 'US',
    },
    // City only where the area actually is one. An airport or a region served is a
    // Place; typing it as a City is a schema.org lie that rich-results testing flags.
    areaServed: areas.map((a) => ({
      '@type': a.state ? 'City' : 'Place',
      name: a.state ? `${a.name}, ${a.state}` : a.name,
    })),
    serviceArea: {
      '@type': 'GeoCircle',
      geoMidpoint: {
        '@type': 'GeoCoordinates',
        address: `${serviceArea.baseCity}, ${serviceArea.baseState}`,
      },
      geoRadius: serviceArea.radiusMiles * 1609, // miles → metres
    },
    knowsAbout: seo.category,
    openingHoursSpecification: hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      description: `${h.days}: ${h.hours}`,
    })),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** FAQPage, emitted wherever FAQAccordion renders. */
export function faqPageJsonLd(faqs: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
