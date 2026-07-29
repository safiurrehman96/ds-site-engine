/**
 * PAYLOAD — Kleen Car Care (migration client #1).
 *
 * Transcribed from the live GHL site at kleencarcare.com. Every value here is
 * observed, not invented. Items that could not be observed are marked TODO and
 * listed in PHASE-0-NOTES.md.
 */
import { defineSiteConfig } from '../src/config-schema';

export const siteConfig = defineSiteConfig({
  site: {
    url: 'https://kleencarcare.com',
  },

  brand: {
    name: 'Kleen Car Care',
    tagline: 'Mobile auto detailing that comes to you.',
    blurb:
      "Kleen Car Care is Northern Virginia's mobile detailing service. Based in Sterling, VA, we bring professional auto, motorcycle, ATV, and golf cart detailing directly to your driveway across the DMV area.",
    logoPath: './assets/logo.jpg',
    footerNote:
      'Our mobile detailing team comes to you — no drop-off, no waiting.',
  },

  contact: {
    phone: '+18775208638',
    phoneDisplay: '(877) 520-8638',
    email: 'hashim@kleencarcare.com',
    address: {
      // Mailing address is Herndon; the brand markets from Sterling. Both are correct
      // and both appear on the live site — see serviceArea.baseCity.
      street: '13251 Overcup Oak Ct',
      city: 'Herndon',
      state: 'VA',
      zip: '20171',
    },
  },

  serviceArea: {
    baseCity: 'Sterling',
    baseState: 'VA',
    radiusMiles: 50,
    label: 'Northern Virginia and the greater DMV area',
  },

  hours: [
    { days: 'Monday - Saturday', hours: '9 AM - 9 PM' },
    { days: 'Sunday', hours: 'Appointments Only' },
  ],

  socials: {
    facebook: 'https://www.facebook.com/profile.php?id=61562012772268',
    instagram: 'https://www.instagram.com/kleencarcare',
    tiktok: 'https://www.tiktok.com/@kleen_detailing',
  },

  ghl: {
    // One GHL calendar per vehicle class — /booking renders these as a chooser.
    bookingUrls: [
      {
        label: 'Sedan / Compact Car',
        url: 'https://links.detailersystems.com/booking/mGZ1WBfSBBfTWWAPMjVT/sc/6a4c2539c0f4c7c30577be1d',
      },
      {
        label: 'SUV / Truck',
        url: 'https://links.detailersystems.com/booking/mGZ1WBfSBBfTWWAPMjVT/sc/6a56eb5ac59a4a677474d213',
      },
      {
        label: 'Motorcycle',
        url: 'https://links.detailersystems.com/booking/mGZ1WBfSBBfTWWAPMjVT/sc/6a56eb6c3e61c6ec8a82f83f',
      },
      {
        label: 'Golf Cart',
        url: 'https://links.detailersystems.com/booking/mGZ1WBfSBBfTWWAPMjVT/sc/6a56eb6244b18d99a8de442b',
      },
      {
        label: 'ATV',
        url: 'https://links.detailersystems.com/booking/mGZ1WBfSBBfTWWAPMjVT/sc/6a56eb66e7d56902aaef62bb',
      },
    ],
    // TODO(fact-needed): the live quote form is a native GHL page-builder form with no
    // standalone embed/funnel URL. A GHL form must be published and its URL pasted here
    // before Phase 2. Placeholder below is NOT a working link.
    quoteUrl: 'https://links.detailersystems.com/widget/form/TODO-KLEEN-QUOTE-FORM-ID',
    // TODO(fact-needed): /faqs links a "Leave Us A Review" button; destination not resolvable
    // from the rendered page. Confirm the Google review URL with the client.
  },

  tracking: {
    gtmId: 'GTM-NCFZRGGB',
  },

  theme: {
    // Starter values for Phase 1. Real preset selection happens in Phase 4.
    preset: 'fresh',
    accentColor: '#1a7f6b',
  },

  modules: {
    howItWorks: true,
    // No credential badge on the live Kleen site.
    // Blog stays on GHL for now — see PHASE-0-NOTES.md open decision 2.
    blogUrl: 'https://kleencarcare.com/blog',
  },

  seo: {
    category: 'Mobile Auto Detailing',
    region: 'Northern Virginia',
  },

  legal: {
    effectiveDate: 'July 2026',
    // Kleen uses the shared Detailer Systems boilerplate, not authored legal copy.
    source: 'template',
  },

  defaults: {
    ctaHeadline: 'Get Your Vehicle Detailed Today',
    socialImage: {
      src: './assets/social.jpg',
      alt: 'Freshly detailed vehicle — Kleen Car Care in Sterling, VA',
    },
    // One video for every hero. The poster is a frame extracted from it:
    //   ffmpeg -ss 2 -i hero.webm -frames:v 1 -vf scale=1280:-2 -q:v 3 hero-poster.jpg
    heroVideo: {
      src: './assets/hero.webm',
      // Safari/iOS fallback:
      //   ffmpeg -i hero.webm -c:v libx264 -profile:v main -crf 26 -preset slow \
      //     -pix_fmt yuv420p -movflags +faststart -an hero.mp4
      fallbackSrc: './assets/hero.mp4',
      poster: {
        src: './assets/hero-poster.jpg',
        alt: 'Mobile detailing in progress — Kleen Car Care in Sterling, VA',
      },
    },
  },
});

export default siteConfig;
