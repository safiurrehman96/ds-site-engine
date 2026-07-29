/**
 * PAYLOAD — JetSpa (aircraft detailing, KTEB / KMMU / KABE / KHPN).
 *
 * ⚠️  THIS CONFIG CONTAINS PLACEHOLDERS. IT MUST NOT SHIP.
 *
 * Facts that have not been supplied yet are filled with values containing the string
 * "PLACEHOLDER", by decision, so the site can be built and reviewed before onboarding
 * is complete. They are deliberately not plausible: a made-up street address that
 * looks real survives review and reaches production, while "PLACEHOLDER" in the footer
 * cannot. src/lib/site-config.ts warns on every build that they are still here, and
 * DS_STRICT=1 turns that warning into a build failure — set it in any deploy pipeline.
 *
 * The honest record of what is missing is clients/jetspa/source/intake.json, where
 * those fields are null. Fill intake first, then mirror the value here.
 *
 * Payloads import nothing — see clients/kleen/site.config.ts for why.
 */
export const siteConfig = {
  site: {
    // Stated as http:// in the client's own Privacy Policy; https assumed. Confirm.
    url: 'https://jetspa.co',
  },

  brand: {
    name: 'JetSpa',
    // Drafted from the client's own home-page copy, not invented. Needs sign-off.
    tagline: 'Certified aircraft detailing for private aviation.',
    blurb:
      'JetSpa is a New Jersey based aircraft detailing company serving four of the busiest general aviation airports in the Northeast. Appearance care for private aviation exclusively — ADA-certified technicians, OEM-approved chemistry, and badge access at every field we work.',
    logoPath: './assets/logo.jpg',
  },

  contact: {
    phone: '+17148370004',
    phoneDisplay: '(714) 837-0004',
    email: 'karangogna86@gmail.com',
    address: {
      // TODO(fact-needed): postal address not supplied. Renders in the footer and in
      // LocalBusiness JSON-LD.
      street: 'PLACEHOLDER — address not supplied',
      city: 'PLACEHOLDER',
      state: 'NJ',
      zip: '00000',
    },
  },

  serviceArea: {
    // TODO(fact-needed): the export says only "New Jersey based".
    baseCity: 'PLACEHOLDER',
    baseState: 'NJ',
    // TODO(fact-needed): radius not supplied; 100 is a placeholder, not a claim.
    radiusMiles: 100,
    label: 'the Northeast — NY, NJ, PA, CT, MD, DE, and VA',
  },

  // TODO(fact-needed): opening hours not supplied.
  hours: [{ days: 'PLACEHOLDER — hours not supplied', hours: 'PLACEHOLDER' }],

  socials: {
    // Instagram is the only account; the rest are skipped by decision.
    instagram: 'https://www.instagram.com/jet_spa',
  },

  ghl: {
    // TODO(fact-needed): six calendars, one per aircraft class, still to be built in
    // GHL. example.com is reserved by RFC 2606 and can never resolve to a real
    // business — a plausible-looking links.detailersystems.com URL could.
    bookingUrls: [
      { label: 'Piston Aircraft', url: 'https://example.com/PLACEHOLDER-booking-piston' },
      { label: 'Turboprop Aircraft', url: 'https://example.com/PLACEHOLDER-booking-turboprop' },
      { label: 'Light Corporate Jet', url: 'https://example.com/PLACEHOLDER-booking-light-jet' },
      { label: 'Midsize Corporate Jet', url: 'https://example.com/PLACEHOLDER-booking-midsize-jet' },
      { label: 'Large Corporate Jet', url: 'https://example.com/PLACEHOLDER-booking-large-jet' },
      {
        label: 'Super Corporate Jet / Boeing Business Jet',
        url: 'https://example.com/PLACEHOLDER-booking-super-jet',
      },
    ],
    // TODO(fact-needed): GHL quote form not published yet.
    quoteUrl: 'https://example.com/PLACEHOLDER-quote-form',
  },

  tracking: {
    // TODO(fact-needed): no GTM container yet. This ID matches nothing, so the
    // container script 404s harmlessly — but nothing is being measured either.
    gtmId: 'GTM-PLACEHOLDER',
  },

  theme: {
    preset: 'stealth' as const,
    accentColor: '#1f6f8b',
  },

  modules: {
    howItWorks: true,
  },

  seo: {
    category: 'Aircraft Detailing',
    region: 'the Northeast',
  },

  legal: {
    // TODO(fact-needed): effective date not set.
    effectiveDate: 'PLACEHOLDER',
    // JetSpa supplied its own Privacy Policy and Terms of Service, with aviation
    // liability and warranty clauses the shared template cannot express. That text
    // has NOT been through Detailer Systems' legal review.
    source: 'client' as const,
  },

  defaults: {
    ctaHeadline: "Book Your Aircraft's Next Detail",
    socialImage: {
      src: './assets/social.jpg',
      alt: 'PLACEHOLDER social share image — JetSpa',
    },
    heroVideo: {
      src: './assets/hero.webm',
      fallbackSrc: './assets/hero.mp4',
      poster: {
        src: './assets/hero-poster.jpg',
        alt: 'PLACEHOLDER hero image — JetSpa',
      },
    },
  },
};

export default siteConfig;
