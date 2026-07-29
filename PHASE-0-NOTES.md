# Phase 0 — Contract frozen. Notes, deviations, and open items.

Status: **Definition of Done met.** `astro check` reports 0 errors; all 16 payload files
parse against the schemas; validation was negative-tested and fails with named errors.

## What exists

```
src/config-schema.ts     SiteConfig interface + zod (Layer 1)
src/content.config.ts    services · areas · home · about · faqs (Layer 2)
client/site.config.ts    Kleen Car Care payload
client/content/          16 files: 4 services, 9 areas, home, about, faqs
```

Verified entry counts: 4 services · 9 areas · 7 packages · 18 service FAQs ·
16 site FAQs in 4 groups · 3 about blocks.

Negative tests (all fail the build with the field named):
- `metaDescription` > 160 chars → `areas → vienna-va ... metaDescription must be 160 characters or fewer`
- area slug without `-{st}` → `slug: area slug must end in "-{st}"`
- `accentColor: 'teal'` → `Invalid client/site.config.ts: · theme.accentColor: must be a 6-digit hex value`

## Schema extensions beyond the plan (guardrail: extend + note, never inline)

1. **`packages[].tagline`** — resolves the plan's truncated `{name, durationBadge?, image?, body, }`.
   Every Kleen package renders a second-line subtitle above its body ("Clean From Every
   Angle", "Our Flagship Service"). No price field: Kleen is quote-only, and inventing
   pricing is forbidden.
2. **`services.crossSell`** — the "We Detail Every Vehicle Type" internal-linking block.
   Kleen uses this slot where the spec's San Mob template uses `whyItMatters`. Both exist;
   `crossSell` is required, `whyItMatters` and `explainer` are optional (Kleen has neither).
3. **New collections `home`, `about`, `faqs`** — the plan had nowhere for home/about/FAQ
   prose to live. `site.config.ts` is NAP and settings only, so putting copy there would
   have broken the engine/payload split. Three singleton collections instead.
4. **`services.processHeading` / `processNote`**, **`ctaHeadline`** on every page type —
   these strings vary per page on the live site and would otherwise be hardcoded in recipes.
5. **`processSteps[].title` is optional** — home "How It Works" steps have bolded lead-ins;
   service-page steps are bare sentences.
6. **`areas.isHeadquarters`** — Sterling renders as "Sterling HQ" in nav.
7. **`ghl.bookingUrls[]` is a list, not a single URL** — `/booking` is a vehicle-type
   chooser with one GHL calendar per class (Sedan, SUV/Truck, Motorcycle, Golf Cart, ATV).
   The plan assumed one link-out.
8. **`serviceArea`** block — radius and base city drive "we come to you" claims and
   `LocalBusiness.areaServed`. Note the base city (Sterling) differs from the mailing
   address city (Herndon); both are accurate and both appear on the live site.
9. **`contact.phone` is E.164, `phoneDisplay` is the human form** — needed for valid
   `tel:` links and `LocalBusiness` JSON-LD.

## Decisions taken (previously open)

| Item | Decision |
|---|---|
| `modules.reviews` | **Dropped.** No `ReviewsStrip` component exists in the 14. A config flag with no renderer is dead weight. Revisit as an explicit component proposal. |
| `/blog` | **Stays on GHL.** Modelled as `modules.blogUrl` — an external nav link. Kleen has 2 posts + 3 category pages that Astro would otherwise need to own. |
| `/contact` | Nav "Contact" maps to `/get-quote`. No separate route. |
| Meta keywords | **Omitted deliberately.** In spec §10, dead for ranking. |
| Recipe F (special modules) | Out of scope. Kleen has none. |
| Image handling | Schema takes `{src, alt}` strings, not Astro's `image()` helper, because no photos have been placed yet. Phase 1 switches to `image()` once `client/assets/` is populated — that upgrade is what makes missing files fail the build. |

## Roadmap change — Kleen is a fixture, not a migration (decided 2026-07-29)

Kleen stays on the GHL builder. Its payload exists **only** to build and validate the
engine against known-good real content, and to supply the `/styleguide` route. A new
client already in the pipeline becomes the first real deploy.

Consequences:
- Phase 3 (deploy, DNS, GTM, Search Console, 301s) targets the new client, not Kleen.
- The plan's Phase 5 "client #2" collapses into that same client.
- Open items 1, 2 and 4 below stop being blockers — the equivalents are needed for the
  new client instead. They stay listed because the fixture still references them.
- **Overfitting risk.** The engine is being shaped by exactly one payload: 4 services,
  9 areas, a single package on 3 of 4 service pages. San Mob has 12 services and multiple
  package tiers. Get the new client's intake data in early so the schemas meet a second
  shape before they harden.

## Open items — need a human

1. ~~**`ghl.quoteUrl` is a placeholder.**~~ No longer blocking (fixture only). The live
   quote form is a native GHL page-builder form with no standalone embed URL; the new
   client will need a published GHL form URL before its Phase 2.
2. ~~**Review URL unknown.**~~ No longer blocking. `/faqs` has a "Leave Us A Review"
   button whose destination isn't resolvable from the rendered page.
3. **No photography yet.** `client/assets/` is empty. Every `heroImage`/`image` path in the
   payload points at a filename that does not exist. Source images are on GHL's CDN
   (`assets.cdn.filesafe.space`) and need downloading + renaming to the fixed convention.
4. **NAP inconsistency on the live site.** Address is Herndon, VA 20171; the brand markets
   from Sterling. `LocalBusiness` JSON-LD needs one canonical address — confirm which.
5. **"Deep Interior Detail" has no package block.** It's referenced in the FAQ copy and in
   the meta description of `/auto-detailing`, but the page has no section for it. Not
   invented here. Confirm whether it's a real fifth tier.

## Live-site copy corrections applied

Transcription was verbatim except for these, all typos in the source:
- "Get A Qoute" → CTA label, now engine-side and spelled "Get A Quote" (appears ~30×)
- "Full Motorcylce Detail" → "Full Motorcycle Detail" (package name)
- "Why Leesburn Residents Choose Mobile Dgtailing" → "Why Leesburg Residents Choose Mobile Detailing"
- "Services Available in Ashburn, vA" → heading is formula-generated, casing fixed by construction
- `/faqs` "What are your hours?" answered "9 AM - 9 PM" with no days; expanded to match the
  footer hours block ("Monday through Saturday, 9 AM to 9 PM. Sundays are by appointment only.")

## Deviation to confirm in Phase 1

Kleen's live home order is intro → **ServicesGrid** → trust; Recipe A specifies
intro → trust → ServicesGrid. `index.astro` will follow the recipe, since the recipe is
the spec. Flagging because it is a visible change from the current site.
