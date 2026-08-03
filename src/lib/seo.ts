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
 * became "Mobile Auto Detailing in Sterling, VA | Acme Detailing"), so the two pages
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

/*
 * JSON-LD builders. Each returns one node of the page's single @graph — no
 * `@context` here; SEOHead wraps every page's nodes in one
 * `{"@context": …, "@graph": […]}` script, so the nodes can reference each other
 * by `@id` (Service → provider → LocalBusiness) the way the live SanMob site does.
 */

/** Site-level node, identical on every page. */
export function webSiteJsonLd(config: SiteConfig): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${config.site.url}/#website`,
    name: config.brand.name,
    url: config.site.url,
  };
}

/** Per-page node tying the page's title/description into the graph. */
export function webPageJsonLd(
  config: SiteConfig,
  page: { title: string; description: string; path: string },
): Record<string, unknown> {
  const url = canonical(config, page.path);
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: page.title,
    url,
    description: page.description,
    isPartOf: { '@id': `${config.site.url}/#website` },
    about: { '@id': `${config.site.url}/#business` },
  };
}

/**
 * Service pages: the node that says "this business offers this service in these
 * places" — provider links back to the LocalBusiness by @id.
 */
export function serviceJsonLd(
  config: SiteConfig,
  service: { name: string; description: string; slug: string },
  areas: Array<{ name: string; state?: string }>,
): Record<string, unknown> {
  const url = canonical(config, `/${service.slug}`);
  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: service.name,
    description: service.description,
    url,
    serviceType: config.seo.category,
    provider: { '@id': `${config.site.url}/#business` },
    areaServed: areaServedNodes(areas),
  };
}

/**
 * Home → Services → {Service}. There is no /services index page (by design — the
 * services live on home and in the nav), so the middle crumb points at home, the
 * same shape the live SanMob site ships. The last crumb carries no `item`:
 * schema.org defines it as the current page.
 */
export function serviceBreadcrumbJsonLd(
  config: SiteConfig,
  service: { name: string; slug: string },
): Record<string, unknown> {
  const url = canonical(config, `/${service.slug}`);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${config.site.url}/` },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${config.site.url}/` },
      { '@type': 'ListItem', position: 3, name: service.name },
    ],
  };
}

// City only where the area actually is one. An airport or a region served is a
// Place; typing it as a City is a schema.org lie that rich-results testing flags.
function areaServedNodes(areas: Array<{ name: string; state?: string }>) {
  return areas.map((a) => ({
    '@type': a.state ? 'City' : 'Place',
    name: a.state ? `${a.name}, ${a.state}` : a.name,
  }));
}

/**
 * LocalBusiness from the footer NAP (spec §10). Emitted on every page.
 * `areaServed` is fed from the areas collection so adding a city updates the schema.
 */
export function localBusinessJsonLd(
  config: SiteConfig,
  areas: Array<{ name: string; state?: string }>,
  logoUrl?: string,
): Record<string, unknown> {
  const { brand, contact, serviceArea, hours, socials, seo } = config;
  const sameAs = Object.values(socials).filter((u): u is string => Boolean(u));

  return {
    '@type': 'LocalBusiness',
    '@id': `${config.site.url}/#business`,
    name: brand.name,
    description: brand.blurb,
    url: config.site.url,
    telephone: contact.phone,
    email: contact.email,
    // `logoUrl` is the built, absolute URL, resolved by the caller. Concatenating
    // site.url + brand.logoPath here yields a 404: Astro emits hashed files under
    // /_astro — the same trap ogImageUrl() documents. Kept as a parameter so this
    // module stays free of astro:assets and remains unit-testable.
    ...(logoUrl ? { image: logoUrl } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: contact.address.street,
      addressLocality: contact.address.city,
      addressRegion: contact.address.state,
      postalCode: contact.address.zip,
      addressCountry: 'US',
    },
    areaServed: areaServedNodes(areas),
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

/** FAQPage structured data, emitted on pages that render authored FAQs. */
export function faqPageJsonLd(faqs: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
