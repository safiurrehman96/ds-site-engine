# Detailer Systems — Astro Site Engine: Implementation Plan

> Guide for Claude Code. Work through phases in order. Each phase has a Definition of Done — do not start the next phase until it passes. When in doubt, prefer the boring option: the whole point of this system is that agents can operate it reliably.

## Context

We (Detailer Systems) build websites for mobile auto detailing businesses. Today they're built manually in the GoHighLevel (GHL) website builder from 4 templates — a fulfillment bottleneck that can't be automated. We're replacing the websites with an Astro-based system while keeping everything else (booking calendars, quote forms, CRM, automations) in GHL.

Reference sites (current GHL builds — the pattern source, not pixel targets):
- https://waxonwarriors.com (Menifee, CA)
- https://sanmobdetailing.com (Alexandria, VA)
- https://kleencarcare.com (Sterling, VA) ← **migration client #1**

A full structural audit lives in `ds-website-design-system.html` (page taxonomy, recipes, component inventory, SEO formulas). Treat that document as the spec.

## Core principles (do not violate)

1. **Engine vs payload.** The engine (`src/`, `scripts/`) is shared and client-agnostic. The payload (`client/`) is the ONLY place client-specific data lives. Recipes/pages contain zero hardcoded content — everything flows from `client/site.config.ts` and content collections.
2. **Agents select, never design.** Design freedom is confined to: choosing a brand preset, setting one accent color, choosing enum variants, writing copy into fixed slots. No raw CSS values in payloads.
3. **Validation over trust.** All payload data is validated with zod at build time. Malformed content must fail the build with a named error, not ship a broken page.
4. **Zero-JS by default.** Only `FAQAccordion` (native `<details>` preferred) and the mobile nav may use client-side JS. No React, no shadcn, no Storybook.
5. **SEO is a hard requirement.** Semantic HTML, one H1 per page, formulaic meta (see SEO section), sitemap, canonical URLs, JSON-LD, fast Core Web Vitals.
6. **Booking/quote stay in GHL.** `/booking` and `/get-quote` pages link out to GHL funnel URLs from config. Never rebuild those forms.

## Target structure

```
ds-site-engine/
├── src/
│   ├── components/          # 14 components (list below)
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro          # Recipe A (Home)
│   │   ├── [service].astro      # Recipe B — one page per client/content/services/*.md
│   │   ├── [area].astro         # Recipe C — one page per client/content/areas/*.md
│   │   ├── about.astro, faqs.astro, get-quote.astro, booking.astro
│   │   ├── privacy-policy.astro, tos.astro
│   │   └── styleguide.astro     # all components × active preset; noindex
│   ├── styles/
│   │   ├── base.css
│   │   ├── tokens.css           # CSS custom properties, populated from preset + config
│   │   └── presets.ts           # 4–6 curated token bundles
│   └── content.config.ts        # zod schemas for services & areas
├── client/                      # PAYLOAD — the only folder that differs per client
│   ├── site.config.ts
│   ├── content/
│   │   ├── services/*.md
│   │   └── areas/*.md
│   └── assets/                  # hero.jpg, founder.jpg, service-{slug}.jpg, logo.svg|png
├── scripts/new-client.ts        # scaffolds an empty payload (Phase 5)
└── astro.config.mjs
```

## Component inventory (14)

Shell: `TopBar`, `Header` (Services + Areas dropdowns auto-built from collections), `Footer` (5-column: brand / locations / contact / hours / social+CTA, plus DS attribution badge + legal links), `SEOHead`.

Sections: `Hero` (variant: `image | video`), `SplitSection` (props: `imageSide`, `heading`, `body`, `cta?`, `badge?` — covers intro/trust/about/explainer/why blocks), `ServicesGrid` (variant: `tiles | cards`), `AreasGrid`, `PackageCard`, `StepsList`, `AddOnCards`, `FAQAccordion` (emits FAQPage JSON-LD), `SocialStrip`, `CTABanner`.

## Page recipes (component sequences)

- **Home:** Hero → SplitSection(intro) → SplitSection(trust) → ServicesGrid → SplitSection(about, optional badge slot) → StepsList(howItWorks, flag-gated) → SocialStrip → AreasGrid → CTABanner
- **Service:** Hero → SplitSection(intro) → SplitSection(explainer) → PackageCard×n → StepsList(process) → AddOnCards → SplitSection(why) → SocialStrip → FAQAccordion → CTABanner
- **Location:** Hero → SplitSection(local) → ServicesGrid → SocialStrip → SplitSection(why-us) → CTABanner

## URL conventions (fixed)

`/` · `/{service-slug}` · `/{city-slug}` (format `{city}-{st}`, e.g. `great-falls-va`) · `/booking` · `/get-quote` · `/about` · `/faqs` · `/blog` · `/privacy-policy` · `/tos`

## SEO formulas

- Title/OG: `{Service|Category} in {City}, {ST} | {Brand}`
- H1: `{Service|Category} in {City/Area}, {ST}`
- Meta description: service + city + differentiators + "we come to you" + CTA, ≤160 chars
- JSON-LD: `LocalBusiness` (from footer NAP config) on all pages; `FAQPage` where FAQAccordion renders
- Self-referencing canonicals; sitemap via `@astrojs/sitemap`; `/styleguide` noindexed and excluded

---

# Phases

## Phase 0 — Freeze the contract (no components yet)

Tasks:
1. Define the `SiteConfig` TypeScript interface: brand (name, tagline, logoPath), contact (phone, email, address {street, city, state, zip}), hours (array of {days, hours} strings), socials ({facebook?, instagram?, tiktok?}), ghl ({bookingUrl, quoteUrl}), tracking ({gtmId}), theme ({preset, accentColor}), modules ({howItWorks: boolean, credentialBadge?: {image, alt, href}, reviews: boolean}), seo ({category: string /* e.g. "Mobile Auto Detailing" */, region: string}).
2. Define zod schemas in `content.config.ts`:
   - `services`: name, slug, order, shortDescription, heroImage, images[], packages[] {name, durationBadge?, image?, body, }, processSteps[] {title, body}, addons[] {name, image?, body}, faqs[] {q, a}, prose fields: intro, explainer, whyItMatters
   - `areas`: name, slug, state, order, prose fields: heroIntro, localCopy, whyUs
3. Hand-populate the full payload for **Kleen Car Care** from the live site (kleencarcare.com — home, 4 service pages, 9 area pages, about, faqs). Copy real content; do not invent.

Definition of Done: `npx astro check`-clean types; every Kleen page's content exists in the payload; schemas parse it without errors.

## Phase 1 — Engine skeleton + Home

Tasks:
1. `npm create astro@latest` (TypeScript strict). Add `@astrojs/sitemap`. Tailwind optional — if used, tokens still come from CSS custom properties, never hardcoded Tailwind colors.
2. `tokens.css` + a minimal single starter preset (finalize presets in Phase 4).
3. Build shell components + `BaseLayout` + `SEOHead`.
4. Build `Hero`, `SplitSection`, `ServicesGrid`, `AreasGrid`, `SocialStrip`, `CTABanner`.
5. Assemble `index.astro` per the Home recipe from Kleen's payload.

Definition of Done: Kleen home renders locally, fully populated from payload; responsive to 360px; no console errors; zero client JS except mobile nav; Lighthouse (local) ≥ 90 across categories.

## Phase 2 — Remaining recipes

Tasks:
1. Build `PackageCard`, `StepsList`, `AddOnCards`, `FAQAccordion`.
2. `[service].astro` and `[area].astro` via `getStaticPaths` from collections.
3. Utility pages (about, faqs, get-quote, booking — the latter two render a brief message + link/redirect to GHL URLs from config) and legal pages (variable-filled boilerplate).
4. Sitemap, canonicals, LocalBusiness + FAQPage JSON-LD, `_redirects` file support.

Definition of Done: full Kleen site builds; every URL in the conventions list resolves; internal links valid (run a link checker over `dist/`); JSON-LD validates in Google's Rich Results test format.

## Phase 3 — Ship Kleen

Tasks: deploy to Cloudflare Pages; staging subdomain first; GTM verified firing; GHL booking + quote links tested end-to-end; redirects for any slug changes vs the old GHL site; robots + sitemap submitted to Search Console.

Definition of Done: production domain serves the Astro site; bookings verified working; old URLs 301 correctly.

## Phase 4 — Presets + styleguide

Tasks:
1. Implement `presets.ts` with 4–6 curated bundles (palette, font pair via Google Fonts, radius, surface treatment). Working names: `stealth` (near-black/sharp/condensed), `fresh` (white-teal/soft/grotesque), `chrome` (dark blue-silver/metallic), `bold` (high-sat accent/heavy display). Each preset must pass WCAG AA contrast with any reasonable accentColor; add a contrast-validation helper that fails the build otherwise.
2. Build `/styleguide`: every component, every variant, real Kleen content, active preset. Noindex.
3. Stress-test: build Kleen under each preset; fix any component that breaks under any preset.

Definition of Done: switching `theme.preset` alone convincingly re-brands the site; styleguide renders all 14 components; contrast validation enforced.

## Phase 5 — Templatize + client #2

Tasks:
1. Convert repo to a GitHub template. Document the new-client workflow in README.
2. `scripts/new-client.ts`: takes an intake JSON (brand, contact, services list, areas list, GHL URLs, preset choice) → writes `site.config.ts` + skeleton markdown files with empty prose fields + TODO markers.
3. Write copy-generation prompt templates (store in `scripts/prompts/`) for each prose field, parameterized by {city, state, region, major roads, climate/seasonal factors, positioning angle}. Prose requirements: locally specific, no invented facts/certifications/pricing, no keyword stuffing, 80–160 words per field unless the field says otherwise.
4. Run client #2 end-to-end with human review of all generated copy.

Definition of Done: a new client repo goes from intake JSON to deployable build with the only manual steps being copy review, photo placement, and DNS.

## Phase 6 — Tighten (ongoing)

Every manual correction from Phase 5 becomes a prompt fix, a schema constraint, or a build-time validation rule. Add CI: astro check + build + link check + Lighthouse budget. Migrate waxonwarriors.com and sanmobdetailing.com. Add an engine→client `sync` script (copies `src/` into client repos; safe because clients never modify `src/`) once ~5+ clients exist.

---

## Guardrails for Claude Code

- Never hardcode client data in `src/`. If a recipe needs data that config/collections don't provide, extend the schema (and note the change), don't inline it.
- Never add a component variant that isn't in this plan without flagging it as a proposal first.
- Never add client-side JS beyond FAQ accordion + mobile nav without flagging it.
- Never invent business facts in copy (certifications, years in business, pricing, guarantees). If a prose field needs a fact that isn't in the payload, leave a `TODO(fact-needed): ...` marker.
- Prefer native HTML (`<details>`, semantic sections) over JS solutions.
- Keep images optimized via Astro's `<Image>` component; all images require meaningful alt text following the pattern `{subject} — {Brand} in {City}, {ST}` where sensible.
