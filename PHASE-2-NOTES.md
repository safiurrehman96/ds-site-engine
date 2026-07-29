# Phase 2 — Remaining recipes. Notes and deviations.

Status: **Definition of Done met.**

| DoD item | Result |
|---|---|
| Full site builds | ✅ 20 pages |
| Every URL in the conventions list resolves | ✅ (see below) |
| Internal links valid across `dist/` | ✅ 898 links checked, **0 broken** |
| JSON-LD validates | ✅ 20/20 parse; LocalBusiness on every page, FAQPage on all 5 FAQ-bearing pages |

Spot-checked with Lighthouse (mobile, throttled 4G): `/auto-detailing` 99/100/100/100,
`/sterling-va` 98/100/100/100. Still zero non-GTM JavaScript on every page type.
No horizontal overflow at 360px on any of the six page types tested.

## Built

```
src/components/  PackageCard · AddOnCards · FAQAccordion · LegalDoc
src/lib/         legal.ts  (privacy + terms boilerplate, filled from config)
src/pages/       [service].astro (Recipe B) · [area].astro (Recipe C)
                 about · faqs · get-quote · booking
                 privacy-policy · tos
public/          _redirects
```

## URL conventions — all resolving

`/` · `/auto-detailing` · `/motorcycle-detailing` · `/atv-detailing` ·
`/golf-cart-detailing` · 9 × `/{city}-va` · `/booking` · `/get-quote` · `/about` ·
`/faqs` · `/privacy-policy` · `/tos`

`/blog` remains an external link to GHL, per the Phase 0 decision.

## Two SEO defects found and fixed

**1. Duplicate title tags on `/` and `/sterling-va`.** Applying the spec §10 formula to
the home page produced *exactly* the same title as the HQ city page — both
"Mobile Auto Detailing in Sterling, VA | Kleen Car Care". The two pages would compete
for the same query. The live GHL site has the same collision.

Home now targets the region instead: "Mobile Auto Detailing in Northern Virginia |
Kleen Car Care", via a new `buildHomeTitle()`. This is a deliberate deviation from the
spec's home-title formula — one page per target term. Easy to revert if you disagree.

**2. Canonical / sitemap trailing-slash mismatch.** Canonicals emitted
`https://kleencarcare.com/about` while the sitemap and the actual served path were
`https://kleencarcare.com/about/`. Google would treat those as two URLs. `canonical()`
now emits the trailing-slash form. Verified: all 20 canonicals match the sitemap exactly,
and `og:url` matches the canonical on every page.

Also verified: zero duplicate titles, zero duplicate meta descriptions, every description
≤160 chars, every title ≤60 chars, exactly one H1 per page.

## Deviations from the plan

1. **`LegalDoc` is a 15th component.** Not in the plan's inventory of 14. It renders the
   `LegalDocument` shape from `lib/legal.ts` and is used only by the two legal pages.
   Flagging as an addition rather than assuming approval.
2. **Legal text lives in the engine, not the payload.** The plan calls legal pages
   "variable-filled boilerplate", so the prose is engine-side and only the variables come
   from config (brand, URL, phone, email, base city, radius, service list). One new config
   field: `legal.effectiveDate`.
   **This text is a business template, not legal advice** — it should be reviewed once by
   a lawyer at the Detailer Systems level, then reused unchanged across clients.
3. **`getStaticPaths` is deliberately unannotated** in both dynamic routes. Adding
   `: GetStaticPaths` widens the return type and collapses `InferGetStaticPropsType` to
   `never`. Comments in both files explain this so nobody "fixes" it back.
4. **Phase 1 carry-forward closed:** `intro.jpg` moved out of `index.astro` into
   `home.md` as an `introImage` field. No recipe now names an image path.

## Carried forward

- `ghl.quoteUrl` is still the placeholder from Phase 0. `/get-quote` renders and links,
  but the link does not resolve to a real form. Needed before any client ships.
- `/booking` links out to five real GHL calendars — verified present in config, not
  click-tested end-to-end (that is a Phase 3 task against a live client).
- `AddOnCards` supports per-add-on images; Kleen has none, so all 10 add-ons render
  text-only. The image path is untested until a client supplies add-on photography.
- `Hero`'s `video` variant is declared in the contract but only `image` is implemented.
  No client in the fixture set uses video yet.
