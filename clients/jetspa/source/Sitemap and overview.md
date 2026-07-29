# Site Map Overview

**Primary Domain:** `{{custom_values.business_website_url}}`

**Total Pages:** 21

**Build Status:** Ready for Build (all pages)

## Page Structure

### Core Pages

1. Home — /
2. About — /about

### Service Pages

1. Aircraft Ceramic Coating — /aircraft-ceramic-coating
2. Aircraft Interior Detailing — /aircraft-interior-detailing
3. Aircraft Exterior Detailing — /aircraft-exterior-detailing
4. Brightwork Polishing — /brightwork-polishing
5. De-Ice Boot Refurbishment — /de-ice-boot-refurbishment
6. AOG Emergency Aircraft Cleaning — /aog-emergency-cleaning
7. Corporate Jet Detailing — /corporate-jet-detailing
8. Turboprop Aircraft Detailing — /turboprop-aircraft-detailing
9. Piston Aircraft Detailing — /piston-aircraft-detailing

### Conversion Pages

1. Book Today — /booking
2. Booking Confirmed — /booking-confirmed
3. Request a Quote — maps to `{{custom_values.quote_page_link}}`

### Location Pages

1. Aircraft Detailing at Teterboro Airport (KTEB) — /aircraft-detailing-teterboro
2. Aircraft Detailing at Morristown Airport (KMMU) — /aircraft-detailing-morristown
3. Aircraft Detailing at Lehigh Valley Airport (KABE) — /aircraft-detailing-allentown
4. Aircraft Detailing at White Plains Airport (KHPN) — /aircraft-detailing-white-plains

### Legal and Support

1. FAQs — /faqs
2. Privacy Policy — /privacy-policy
3. Terms of Service — /tos

## Header Navigation

Primary nav (left to right):

- Home
- About
- Services (dropdown containing 6 service pages plus 3 aircraft-class pages)
- Locations (dropdown containing all 4 airport pages)
- FAQs
- Get a Quote (button)
- Book Today (primary CTA button)

## CTA Rules

**In page body content:** phone CTA using `{{custom_values.business_phone}}` and quote CTA using `{{custom_values.quote_page_link}}` only. No booking calendar links appear in page bodies.

**In header nav:** Book Today button links to /booking. Get a Quote button links to `{{custom_values.quote_page_link}}`.

**In footer:** phone, email, hours, service location, social links, all location page links, quote link, Privacy Policy, Terms of Service, and Detailer Systems attribution.

## Pricing Display Rule

No dollar amounts, price tiers, or starting prices appear on any live page. Pricing is disclosed via phone call, quote request form, or the Book Today calendar. The Internal Pricing Reference page holds all pricing for the Detailer Systems team only.

## Page Relationship Map

- Home links to every service page, every location page, About, and `{{custom_values.quote_page_link}}`
- About links to at least 2 service pages and `{{custom_values.quote_page_link}}`
- Each service page links to 2 related services, primary location pages, and `{{custom_values.quote_page_link}}`
- Each aircraft-class page links to relevant services, primary location pages, and `{{custom_values.quote_page_link}}`
- Each location page links to at least 2 service pages and `{{custom_values.quote_page_link}}`
- FAQs links to relevant service pages and `{{custom_values.quote_page_link}}`

## Notes

- Location pages target airports by name AND ICAO code (KTEB, KMMU, KABE, KHPN), not city. Morristown ICAO is KMMU (correct code; not MMA as spoken during onboarding).
- Booking calendar cards organize by aircraft class (Piston, Turboprop, Light Jet, Midsize Jet, Large Jet, Super-Corporate Jet / Boeing), not by vehicle type.
- Trust signals emphasized site-wide: ADA (Aircraft Detailing Association) certification, OEM-approved chemistry, $200K general liability + $1.5M hangar liability insurance, and badge access at all 4 primary airports.
- Karan's founder story appears only on the About page as background context. Company-front framing site-wide, presented as the JetSpa team.
- Emergency (AOG) scope: Northeast (NY, NJ, PA, CT, MD, DE, VA). 2+ hours from primary airports qualifies as emergency. 24+ hour notice = no emergency fee.