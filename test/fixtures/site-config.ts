import type { SiteConfig } from '../../src/config-schema';

/**
 * The subset of SiteConfig the pure lib functions read. Cast rather than fully
 * authored: complete valid configs belong to client payloads, and duplicating one
 * here would drift. Tests that need a field not present below should add it, not
 * widen the cast.
 */
export const testConfig = {
  brand: {
    name: 'Acme Detailing',
    blurb: 'Mobile detailing done right.',
    logoPath: './assets/logo.jpg',
  },
  site: { url: 'https://acme.example' },
  seo: { category: 'Mobile Auto Detailing', region: 'Northern Virginia' },
  serviceArea: {
    baseCity: 'Sterling',
    baseState: 'VA',
    radiusMiles: 25,
    label: 'the DMV area',
  },
  contact: {
    phone: '+17035550100',
    phoneDisplay: '(703) 555-0100',
    email: 'hello@acme.example',
    address: { street: '1 Main St', city: 'Sterling', state: 'VA', zip: '20164' },
  },
  hours: [{ days: 'Mon–Sat', hours: '8am–6pm' }],
  socials: { facebook: 'https://facebook.com/acme' },
} as unknown as SiteConfig;
