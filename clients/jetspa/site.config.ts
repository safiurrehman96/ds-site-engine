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
 * Payloads import nothing; validation happens at the engine boundary in
 * src/lib/site-config.ts.
 */
export const siteConfig = {
  template: 'aviation-editorial' as const,

  site: {
    // Stated as http:// in the client's own Privacy Policy; https assumed. Confirm.
    url: 'https://jetspa.co',
  },

  brand: {
    name: 'JetSpa',
    legalName: 'JetSpa LLC',
    tagline: 'Certified aircraft detailing for private aviation.',
    blurb:
      'JetSpa is a New Jersey based aircraft detailing company serving four of the busiest general aviation airports in the Northeast. Certified private aircraft appearance care with OEM-approved chemistry and coordinated airport access.',
    footerNote: 'Every jet deserves a spa day.',
    logoPath: './assets/logo.png',
  },

  contact: {
    phone: '+18665159066',
    phoneDisplay: '(866) 515-9066',
    email: 'booking@jetspa.co',
    address: {
      street: '2 Industrial Drive',
      city: 'Alpha',
      state: 'NJ',
      zip: '08865',
    },
  },

  serviceArea: {
    baseCity: 'Alpha',
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
    // TODO(fact-needed): GHL quote form not published yet.
    quoteUrl: 'https://example.com/PLACEHOLDER-quote-form',
  },

  tracking: {
    // TODO(fact-needed): no GTM container yet. This ID matches nothing, so the
    // container script 404s harmlessly — but nothing is being measured either.
    gtmId: 'GTM-PLACEHOLDER',
  },

  theme: {
    preset: 'noir' as const,
    accentColor: '#b4915c',
  },

  modules: {
    // Off: the strip shows hours + service area, and JetSpa's hours are still
    // placeholders while its coverage story ("the Northeast — NY, NJ, PA, CT,
    // MD, DE, and VA") is too long for a one-liner.
    topBar: false,
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
      src: './assets/social-band.webp',
      alt: 'A polished business jet on the ramp at sunset with a second aircraft beyond',
    },
    heroVideo: {
      src: './assets/hero.webm',
      fallbackSrc: './assets/hero.mp4',
      // A 7-second one-shot reveal: the jet's outline draws itself out of black and the
      // aircraft resolves. Looping would snap it back to an empty frame every 7s.
      loop: false,
      poster: {
        src: './assets/hero-poster.jpg',
        alt: 'A business jet emerging from darkness, its outline picked out in light',
      },
    },
  },
};

export default siteConfig;
