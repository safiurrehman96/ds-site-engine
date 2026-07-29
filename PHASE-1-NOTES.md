# Phase 1 — Engine skeleton + Home. Notes and deviations.

Status: **Definition of Done met.**

| DoD item | Result |
|---|---|
| Home renders fully from payload | ✅ zero content strings in `src/` |
| Responsive to 360px | ✅ no horizontal overflow at 360 / 390 / 768 / 1024 / 1440 |
| No console errors | ✅ (Best Practices 100) |
| Zero client JS except mobile nav | ✅ **zero client JS at all** — see below |
| Lighthouse ≥ 90 all categories | ✅ desktop 100/100/100/100 · mobile 99/100/100/100 |

Core Web Vitals (mobile, throttled 4G): FCP 1.4s · LCP 2.0s · CLS 0.031 · TBT 80ms.
Desktop: FCP 0.3s · LCP 0.4s · CLS 0 · TBT 0ms.

## Built

```
src/styles/     base.css · presets.ts · fresh-fonts.css · fonts/*.woff2
src/lib/        seo.ts (formulas + JSON-LD) · content.ts (ordered collection access)
src/layouts/    BaseLayout.astro
src/components/ SEOHead · TopBar · Header · Footer · SocialLinks · Img · Prose
                Hero · SplitSection · ServicesGrid · AreasGrid · StepsList
                · SocialStrip · CTABanner
src/pages/      index.astro  (Recipe A)
public/         favicon.svg
```

## Deviations from the plan

1. **Zero client JS, not "mobile nav only."** Both nav dropdowns and the mobile menu are
   native `<details>` elements, so the page ships no JavaScript beyond GTM. This satisfies
   the guardrail "prefer native HTML over JS solutions" more strictly than the plan required.
2. **`StepsList` pulled forward from Phase 2.** Recipe A includes `StepsList(howItWorks)`,
   and Kleen's home page uses it, so the home page could not be completed without it.
3. **Fonts are self-hosted, not linked from Google.** The Google Fonts stylesheet was
   render-blocking for ~1.7s and held Performance at 80. Two variable `.woff2` files
   (Inter 400–600, Space Grotesk 500–700) now ship first-party. Performance went 80 → 100.
   `PresetTokens.fonts.href` was removed as a result.
4. **`sharp` added as an explicit dependency.** Astro 7 does not bundle it and pnpm does
   not hoist it, so image optimization failed the build until it was installed directly.
5. **`defaults.areaHeroImage` / `defaults.socialImage` added to SiteConfig.** See below.

## Findings from the real payload

**Kleen has ~13 photographs for a 20-page site.** All 9 area pages and 3 of the 4 service
pages have *zero* unique imagery on the live site — they reuse the same shared files.
Rather than duplicate one file nine times, `areas.heroImage` is now optional and falls
back to `defaults.areaHeroImage`. Expect the same for most clients.

**The source photography is small.** Originals off GHL's CDN: hero 910×605, service cards
800×449, package shots 400×300. That is under-sized for a full-bleed hero on a 2× display.
It does not hurt Lighthouse today (the hero is only served at 910w), but the new client
needs source images at ~2000px wide to look sharp on modern screens.

**A real contrast bug, caught by Lighthouse.** `StepsList`'s step number rendered accent
text on a 12% accent tint — 4.19:1, below the 4.5:1 AA threshold. Now solid accent with
`--ds-on-accent`. This is exactly the failure mode Phase 4's contrast-validation helper is
meant to catch automatically across all presets.

## Carried forward

- Only the `fresh` preset is implemented. `getPreset()` throws a named error for the other
  three rather than silently rendering a half-designed site. Phase 4 authors them.
- `fresh-fonts.css` is imported unconditionally; Phase 4 needs a preset → stylesheet map.
- `public/favicon.svg` is a neutral engine default. Per-client favicons are a payload
  concern for Phase 5.
- `intro.jpg` is referenced directly in `index.astro` for the intro SplitSection. That is
  the one image path the recipe names rather than the payload — it should move into
  `home.md` as an `introImage` field in Phase 2.
