# Phase 4 — Presets + styleguide. Notes and deviations.

Status: **Definition of Done met.**

| DoD item | Result |
|---|---|
| Switching `theme.preset` alone convincingly re-brands the site | ✅ 4 presets, each with its own display face, palette, radius scale and structural motifs |
| Styleguide renders every component | ✅ `/styleguide`, noindexed, excluded from sitemap |
| Contrast validation enforced | ✅ fails the build with a named error; negative-tested |

Lighthouse (mobile, throttled 4G) on the home page under **every** preset:

| preset | perf | a11y | best practices | seo | colour-contrast audit |
|---|---|---|---|---|---|
| fresh | 98 | 100 | 100 | 100 | pass |
| stealth | 98 | 100 | 100 | 100 | pass |
| chrome | 98 | 100 | 100 | 100 | pass |
| bold | 98 | 100 | 100 | 100 | pass |

21 pages build under each preset. 1,429 internal links, 0 broken.

## The four presets

| preset | display face | motif |
|---|---|---|
| `fresh` | Space Grotesk | curved dividers, raised cards, sentence-case headings |
| `stealth` | Oswald (condensed) | angled dividers, outline cards, uppercase headings, 0–3px radii |
| `chrome` | Sora | angled dividers, raised cards, tight tracking |
| `bold` | Anton (heavy) | curved dividers, uppercase headings, hard offset shadows |

> **Addendum, 2026-07-30.** A fifth preset, `noir`, was added after this phase closed —
> near-black surfaces, stealth's motifs and typography at inverted polarity. It exists
> because a *light* accent (brass, champagne, bronze) cannot clear WCAG AA as a fill on
> light paper at any tuning, so JetSpa's brand colour needed the surfaces to move rather
> than the colour. Two engine changes came with it: `deriveTextSafe` now picks its
> direction from the surfaces instead of always darkening, and `--ds-on-accent` is derived
> per accent by `pickOnAccent` instead of being a fixed per-preset white. Everything below
> in this document describes the original four and still holds for them.

All fonts self-hosted from `public/fonts` — five variable `.woff2` files, 11–47KB each.
Only the active preset's `@font-face` rules are emitted.

## Token vocabulary expanded (as planned, before authoring presets)

A preset now carries **structural motifs**, not just colour: `divider` (flat/angle/curve),
`cardStyle` (raised/outline), `headingCase`, `headingTracking`, `accentRule`, and hero
scrim strength. These ship as `data-*` attributes on `<body>`, so components respond to
them without any preset-specific code leaking into recipes. Section dividers are drawn
generically off `data-tone`, so they work for every component with zero per-component code.

## Derived accent tokens — the notable design decision

The stress test failed on two presets: Kleen's teal hit **4.41:1** on `stealth`'s paper and
**4.32:1** on `chrome`'s, just under the 4.5:1 AA threshold for small text.

Hand-tuning each preset's palette against one client's accent would not have held for the
next client. Instead the engine now **derives** two tokens from the chosen accent:

- `--ds-accent-ink` — darkened until it clears AA against both `paper` and `card`. Used
  everywhere the accent appears as small text (eyebrows, "Learn more", package taglines,
  FAQ group titles, area arrows).
- `--ds-accent-on-deep` — lightened until it clears AA-large against `deep`.

`--ds-accent` itself is now only used for fills. Contrast validation therefore checks only
what derivation cannot fix — the accent as a fill with `on-accent` text on top of it.
Confirmed working: the derived ink is `#1a7f6b` on fresh/bold and `#187765` on
stealth/chrome, from the same input accent.

Negative test (accent `#7fd4c1`) still fails the build:
```
theme.accentColor "#7fd4c1" fails WCAG AA against the "fresh" preset:
  · button label on accent fill (--ds-on-accent vs accent): 1.74:1 — needs 4.5:1
  · accent fill against page background (accent vs --ds-paper): 1.63:1 — needs 3:1
```

## Video heroes (new standing requirement)

`Hero` is video-backed on every page. The poster is a still extracted from that same video,
renders as a normal optimized `<Image>` and carries LCP; the video layers over it. It
autoplays regardless of `prefers-reduced-motion` — see the dedicated section below.

**Kleen's source video was 4.4MB**, which Lighthouse barely registered (99 → 98) because
the poster carries paint — but it was 4.4MB of real data on every page view. Re-encoded to
1280×720 VP9 CRF 40: **998KB**, page weight 4,983 KiB → 1,620 KiB.

Because that failure mode is invisible to Lighthouse, `src/integrations/asset-budget.ts`
now fails the build for oversized payload assets (1.5MB video, 600KB images) with the
ffmpeg command to fix it. Negative-tested at 2,952KB.

## Bug fixed: the desktop nav was never visible

`display: contents` cannot reveal a closed `<details>` — a closed disclosure hides its
children regardless. The entire desktop nav was in the HTML and painted nowhere, at every
width. Neither the link checker nor Lighthouse caught it: the links existed and were valid.
Screenshots caught it immediately.

Now two nav instances render from the same link arrays — a plain `<nav>` at ≥1024px, the
`<details>` disclosure below. Still zero client JS.

## Correction to a Phase 4 interim claim

I reported the `SocialStrip` photo as invisible ("dark image on a dark band"). That was
wrong — it was a screenshot artifact. The image is `loading="lazy"`, and captures taken
with `captureBeyondViewport` never scrolled it into view, so it had not decoded. Scrolling
first shows all 8 images decoding with none broken. The accent panel and supporting line
added to that component are still worth keeping, but nothing was broken.

**Method note for future visual QA: always scroll the page before capturing, or lazy
images below the fold will read as missing.**

## Other visual fixes

- Copy-only `SplitSection`s centre their column instead of leaving half the viewport empty.
- `SplitSection` uses a 1.05/0.95 asymmetric split and an offset accent panel behind the
  photo (suppressed below 640px so it cannot cause overflow).
- The header now renders the client logo instead of the brand name as text.

## Per-client colour: what is fixed vs free

Free per client, in `client/site.config.ts`:

```ts
theme: { preset: 'fresh', accentColor: '#1a7f6b' }
```

Fixed per preset: `ink`, `ink-soft`, `paper`, `card`, `line`, `on-accent`, fonts, radii,
shadows, motifs. Everything else is **derived** from the accent:

| token | derivation |
|---|---|
| `--ds-accent-ink` | darkened until AA against `paper` and `card` |
| `--ds-deep` | preset dark tinted toward the accent by `deepTint`, backed off if `on-deep` would drop below AA |
| `--ds-on-deep-soft` | lightened until AA against the derived `deep` |
| `--ds-accent-on-deep` | lightened until AA-large against the derived `deep` |

Derived values with accent `#1a7f6b`:

| preset | deepTint | base deep | derived deep |
|---|---|---|---|
| fresh | 0.16 | `#0f1c26` | `#112c31` |
| stealth | 0.07 | `#08080a` | `#091011` |
| chrome | 0.18 | `#101a2e` | `#122c39` |
| bold | 0.12 | `#16151a` | `#162224` |

Accessibility after tinting, all four presets: **a11y 100, colour-contrast audit pass**,
performance 98–99.

The favicon is no longer a static file — `src/pages/favicon.svg.ts` generates it from
`theme.accentColor`. It previously hardcoded Kleen's teal, which was the only
client-specific colour that had leaked into the engine and did not follow the accent.

`deepTint` is a preset-level constant, not a payload field: it adds brand presence on every
page without giving an agent a second raw colour to get wrong. If a client's brand ever
demands a specific dark, promoting `deep` to a payload value is the next step — at the cost
of re-validating `on-deep`, `on-deep-soft` and `accent-on-deep` against it.

## Styleguide routes

| route | purpose |
|---|---|
| `/styleguide` | every component under the **configured** preset |
| `/styleguide/{preset}` | the same under any preset, without editing `site.config.ts` |
| `/styleguide/{preset}/bare` | identical, switcher suppressed — embed target only |
| `/styleguide/compare` | all four side by side, one iframe per preset |

`BaseLayout` gained an optional `preset` prop so a route can override the configured
preset. Only the styleguide uses it; client pages always render `theme.preset`.

Compare embeds the **real** per-preset routes in iframes rather than mocking them, so what
you see is genuinely that preset rendering. Columns scroll independently. Zero JS.

All 10 styleguide routes are noindexed and excluded from the sitemap (still 20 URLs).

**`?bare` did not work.** The first attempt used a query param read via
`Astro.url.searchParams`. Query strings are not available at build time in a static build,
so it silently did nothing and the switcher rendered inside every compare column. Replaced
with a dedicated `/bare` route. Verified: switcher markup count is 1 on full routes, 0 on
bare routes.

## Hero video: reduced motion deliberately not honoured

Decided 2026-07-29, after the user reported the video never playing on their machine.

Root cause was our own accessibility rule: the video was `display: none` under
`prefers-reduced-motion: reduce`, which the user has enabled. The rule has been removed —
the hero now autoplays for everyone, matching the GHL sites this engine replaces (verified:
their `<video autoplay playsinline loop muted class="bgVideo cover">` has no preference
handling and no pause control).

**Accepted trade-off:** an autoplaying loop with no pause control does not satisfy WCAG 2.2
SC 2.2.2 (Pause, Stop, Hide, Level A). Note this was *already* true for non-reduced-motion
visitors before the change — respecting the preference never fixed 2.2.2, it only changed
who it affected. Lighthouse does not test 2.2.2, so scores stay at 100 either way. The fix,
if revisited, is a pause/play control (~15 lines of JS, a third exception to zero-JS).

The poster still covers autoplay being blocked (iOS Low Power Mode), slow connections and
decode failure.

**Verification-method correction.** Several rounds of checks reported the video as working
(`readyState: 4`, `paused: false`, rising `currentTime`) while it was invisible behind
`display: none`. Headless Chrome defaults to `prefers-reduced-motion: reduce`, and element
playback state does not prove visibility. Visual checks must now set
`Emulation.setEmulatedMedia` explicitly and assert computed `display` and box size, or diff
two screenshots a second apart.

**Also fixed while diagnosing** (both real, neither the actual cause):
- `preload="none"` suppressed autoplay in Safari — Chrome ignores it when `autoplay` is set.
  Now `preload="metadata"`.
- WebM-only with no MP4 source: VP9-in-WebM support on Safari/iOS is partial, so those
  visitors silently saw only the poster. An H.264 MP4 fallback was added
  (`heroVideo.fallbackSrc`), WebM first so capable browsers still get the smaller file.

**Not a bug:** `/client/assets/hero.webm` returns 404 when typed into the address bar but
200 when requested by the `<video>` element. Astro's dev router handles HTML navigations;
Vite's static middleware serves subresources.

## Signature motifs: texture + button style

Two more motif tokens, applied to what appears on every page — the dark bands
(TopBar, Footer, SocialStrip) and `.ds-btn`.

| preset | texture on dark bands | button |
|---|---|---|
| `fresh` | accent glow bleeding from top-right | pill, lift on hover |
| `stealth` | fine diagonal hairlines | squared, uppercase, wide tracking |
| `chrome` | top highlight + raking sheen | pill with top-lit gradient |
| `bold` | halftone dot field | 2px ink border, hard offset shadow that presses on hover |

Both ship as `data-texture` / `data-button` on `<body>`, styled entirely in `base.css`.
Components carry a `ds-deep-surface` class; the texture draws in an `::after` beneath
content and never intercepts clicks. No component knows which preset is active.

Hard-shadow buttons deliberately exclude `.ds-btn--ghost` — an ink shadow is invisible on
a dark band.

Lighthouse after the change, all four presets: **a11y 100, contrast pass, best practices
100, SEO 100**; performance 96–97 (down ~1–2 from the extra paint work on the textures).

## Section rhythm: kickers + per-preset head treatment

Every section head now opens with a small kicker label above the heading, and the
`accentRule` boolean was replaced by a four-way `headStyle` token — the same head reads as
four different design languages.

| preset | headStyle | how it looks |
|---|---|---|
| `fresh` | `rule` | short accent bar leading into the label |
| `stealth` | `bar` | heavy accent rule down the left of the whole head block |
| `chrome` | `line` | label, then a hairline running out to the right |
| `bold` | `stamp` | label set as a filled accent chip |

Kickers have per-component defaults (`Services`, `Coverage`, `Process`, `Add-ons`,
`Questions`), overridable per recipe, and `kicker=""` hides one. `SplitSection`'s existing
`eyebrow` prop now renders through the same `.ds-kicker` treatment so blocks and sections
match. On dark bands the kicker switches to `--ds-accent-on-deep` automatically.

The `bar` treatment is deliberately skipped on centred copy-only `SplitSection`s, where a
left rule makes no sense.

Lighthouse across all four presets: **a11y 100, contrast pass, best practices 100, SEO
100**; performance 95–97.

## Card and image treatment

`cardStyle` widened from a 2-way to a 4-way token so it mirrors `buttonStyle`, giving each
preset a distinct card personality on hover:

| preset | cardStyle | hover behaviour |
|---|---|---|
| `fresh` | `raised` | shadow lift + image zoom |
| `stealth` | `outline` | no elevation; an accent edge grows along the card top |
| `chrome` | `sheen` | a soft highlight sweeps across the card face |
| `bold` | `hard` | hard offset shadow presses in, matching its buttons |

Shared across all presets: image zoom on hover for `ServicesGrid`, `AddOnCards` and
`PackageCard`; a hover border and lift on add-on cards.

The per-preset rules key off `data-card` and target the card link generically, so they
apply to ServicesGrid, AreasGrid and AddOnCards without per-component code.

**`ServicesGrid` `tiles` variant is now genuinely image-led** — the title sits on the photo
over a gradient scrim instead of below it, which is what the variant was always meant to be.

Caught during review: the first version put the title at the *top* of the tile while the
scrim was bottom-weighted, so white text landed on the bright part of the photo. `.body`
was inheriting `flex: 1` from the cards variant and stretching full height. Fixed with
`flex: 0 0 auto` + `margin-top: auto` so it hugs the bottom, a three-stop scrim, and a text
shadow. Worth noting Lighthouse cannot catch text-over-image contrast — its colour-contrast
audit only inspects solid backgrounds, so this class of bug needs eyes on a screenshot.

Lighthouse across all four presets: **a11y 100, contrast pass, best practices 100, SEO
100**; performance 96, CLS 0.002–0.031.

## Four hero compositions

`heroLayout` is a preset motif with a per-page override (`<Hero layout="…">`). All four
share one markup structure — only CSS differs — so no recipe knows which is active.

| preset | layout | composition |
|---|---|---|
| `stealth` | `fullbleed` | copy left, directly on the footage, heavy scrim |
| `chrome` | `centered` | copy centred over the footage (the astro.build / Starlight pattern) |
| `fresh` | `split` | copy on a solid panel, video contained beside it and bleeding off the right edge |
| `bold` | `card` | copy in a solid offset card with a hard shadow, over full-bleed footage |

Patterns were taken from Astro's own landing pages rather than invented: astro.build and
starlight.astro.build both centre the copy with an eyebrow chip, two CTAs and a trust row
directly below — which is what the overlapping proof card already does.

**`split` is the notable one.** Because the copy sits on a solid panel, it needs no scrim
at all, so the footage plays at full brightness — the van, the detailer and the string
lights are all legible, where the scrimmed layouts wash them out. If a client has good
video, `split` is the layout that actually shows it.

`/styleguide` renders the preset's own layout plus the other three as explicit overrides,
so all four are comparable on one page.

Verified across all four presets: **a11y 100, contrast pass, best practices 100, SEO 100**,
performance 96, LCP 2.4–2.5s, CLS 0.002–0.033, and no horizontal overflow at 360/768/1440.

## AreasGrid: `tiles` variant

`AreasGrid` gained a second variant alongside the existing rows:

- **`list`** — compact rows. The right choice when a client has no per-city photography.
- **`tiles`** — full-bleed photo with the city name set large, uppercase and **centred**,
  over an **even** scrim, image zoom on hover, and an `HQ` badge on the headquarters area.
  Built to match a reference the user supplied from another client site.

  The scrim is deliberately flat rather than bottom-weighted: centred text needs uniform
  darkness behind it, where bottom-anchored text wants a gradient.

  Corners follow the preset's existing `divider` motif rather than adding a token —
  angular presets (`stealth`, `chrome`) get chamfered corners cut top-right and
  bottom-left; soft presets (`fresh`, `bold`) keep the radius scale.

A new optional `areas.image` field feeds it, falling back to the hero poster when unset.
The variant is only worth using when the images actually differ — otherwise it renders N
identical tiles, which is worse than the list.

**Honesty note on the Kleen fixture.** Kleen has no per-city photography, so the nine tiles
use Kleen's own work photos spread across the areas, with alt text describing the *work*
rather than claiming a location, and a comment in each markdown file saying so. None of
these photos was taken in the city it appears on. Real clients should supply genuine local
photography before this variant goes live, or stay on `list`.

Home now uses `tiles`; `/styleguide` shows both variants.

**Centring bug caught by measuring, not by eye.** `place-items: center` was applied and
computed correctly, yet labels sat hard left. The shared `.grid a` rule sets
`justify-content: space-between` for the list variant; in grid context that pushes the
single track to the start, and `place-items` cannot override it. Resetting
`justify-content: center` on the tiles rule fixed it — verified as 0px offset on every
tile. Worth remembering: a computed style can be correct and still be overridden by a
sibling property.

Verified: 9 tiles, 9 distinct images, all decoded, labels centred to 0px. Across all four
presets — **a11y 100, contrast pass, best practices 100, SEO 100**.

## StepsList: four layouts

The old single layout was a four-column grid with a number badge and a sentence. It broke
down at 5–6 steps (wrapping 4+2) and read as a bland list whenever steps had no titles —
which is every service page, since Kleen's process steps are bare sentences.

`stepsStyle` is now a preset motif with a per-page override:

| preset | layout | look |
|---|---|---|
| `fresh` | `timeline` | vertical rail, dots joined by a connecting line, copy to the right |
| `chrome` | `track` | horizontal line through the numbers, copy beneath |
| `bold` | `numerals` | oversized ghosted numbers with a hairline rule, copy below |
| `stealth` | `ledger` | full-width rows, big index left, hairline rules between |

`timeline` and `ledger` handle any step count; `track` distributes evenly and falls back to
a vertical stack below 860px. `/styleguide` renders the preset's own layout plus all four
as explicit overrides using the 6-step service process, so the awkward counts are visible.

Two layout bugs caught by measuring rather than by eye:

- **`track`**: copy was vertically centred, so first lines didn't align across columns. The
  `li` stretches to the tallest column and its auto rows stretch with it — fixed with
  `align-content: start`.
- **`numerals`**: the ghosted numbers ran straight through the body text. Clearing the
  numeral's *line box* rather than its glyphs was the fix — `line-height: 0.8` on the
  numeral plus `padding-top: calc(var(--num-size) * 0.88)` on the item. Verified 0/6
  overlapping via bounding-box comparison.

Service page across all four presets: **a11y 100, contrast pass, best practices 100, SEO
100**, performance 95–97, CLS 0–0.002.

## CTABanner: four treatments

The CTA closes every page, so its treatment is one of the strongest per-preset signals.
`ctaStyle` is a preset motif with a per-page override:

| preset | variant | treatment |
|---|---|---|
| `fresh` | `tint` | soft accent wash on the page background, copy left / buttons right |
| `stealth` | `deep` | dark band carrying the preset's signature texture |
| `chrome` | `image` | full-bleed photo behind a flat scrim, copy centred |
| `bold` | `panel` | contained solid accent block with a hard offset shadow, copy centred |

**The pattern background came free.** `deep` simply carries the existing `ds-deep-surface`
class, so it picks up whichever texture the preset already defines — glow, grid, sheen or
dots — rather than inventing a second pattern system.

`image` defaults to the hero poster and takes an `image` prop for a dedicated photo. Its
scrim is flat rather than gradient, for the same reason as the AreasGrid tiles: centred
copy needs even darkness.

`panel` remaps its buttons — primary becomes ink-on-card and secondary becomes a solid card
fill — because both default styles sit on an accent fill and would otherwise lose contrast.

Bug caught by measuring: at `1.4fr / 1fr` the three CTAs wrapped onto two rows in `tint`
and `deep`. Changed to `minmax(0, 1fr) auto` so the button column sizes to content;
verified one row for both.

All four presets: **a11y 100, contrast pass, best practices 100, SEO 100**.

## SplitSection: four compositions

The highest-leverage remaining gap — the spec calls this component "roughly half of every
page" and it had no variants at all, so the middle of every page was the same block
repeated 2–4 times.

`splitStyle` is a preset motif with a per-page override:

| preset | variant | composition |
|---|---|---|
| `fresh` | `beside` | image alongside copy, sides auto-alternating, offset accent panel |
| `chrome` | `overlap` | copy on a solid card overlapping the image, 12-column grid |
| `stealth` | `wide` | full-bleed image band, copy over a directional scrim |
| `bold` | `stack` | 21:9 image above, copy centred beneath |

A block with **no image ignores the variant** and centres its copy — there is no meaningful
"beside" or "overlap" without a second element. `overlap` also restacks below 900px so the
card rides up over the image's bottom edge rather than sitting beside nothing.

**Bug caught by measuring.** `wide`'s image rendered at 1180×204 instead of 1300×456 —
inset to the container rather than full-bleed. Cause: `base.css` sets
`.ds-section > .ds-container { position: relative }` for the divider wedge, which makes the
container the containing block for any absolutely positioned descendant. Opted the `wide`
variant's container out with `position: static`. Verified full-bleed by comparing media and
section boxes.

That rule now has two components depending on it (`Hero`'s scrim, `SplitSection`'s wide
media) — worth remembering it exists before adding another full-bleed treatment.

Home and service pages, all four presets: **a11y 100, contrast pass, best practices 100,
SEO 100**, performance 95–96, no overflow at 360/900/1440.

## Footer: four shapes

| preset | variant | shape |
|---|---|---|
| `fresh` | `columns` | five equal columns (the spec §04 default) |
| `chrome` | `split` | oversized brand block with a divider rule, condensed link groups right |
| `stealth` | `compact` | tight arrangement, long-form copy suppressed, areas in two columns |
| `bold` | `stacked` | brand centred on its own row, links beneath, everything centre-aligned |

All four share one markup structure — only the grid and a few suppressions differ — so
content and reading order are identical across variants. The footer also now renders the
client logo rather than the brand name as text, matching the header.

**A recommendation I made and then withdrew.** I proposed a `cta` variant where the footer
opens with a call-to-action strip. On inspection that is wrong for this engine: every page
recipe already ends with `CTABanner` immediately above the footer, so a footer CTA would
stack a second call to action directly on the first. Replaced with four shape variants and
noted in the motif's doc comment so it does not get re-proposed.

**Bug: the footer logo rendered at natural size (~150px) instead of 44px.** The rule was
written as `.brand-logo { … }` inside Astro's scoped `<style>`, but the `<img>` is rendered
by `Img.astro` and carries *that* component's scope id — so the selector never matched.
`Header.astro` had it right (`:global(.brand-logo)`); the footer did not. The oversized logo
was also what crushed the `compact` grid into overlapping text, so one fix resolved both.

Worth generalising: **any rule targeting markup rendered by a child component needs
`:global()`.** That applies to every `Img`-rendered element the engine styles.

All four presets: **a11y 100, contrast pass, best practices 100, SEO 100**, performance
95–96, no overflow at 360px.

## `pnpm run stress` — the preset stress test

Phase 4 task 3 ("build Kleen under each preset; fix any component that breaks") is now a
committed script rather than an ad-hoc shell loop. It is also the basis of Phase 6's CI
gate, which the plan specifies as "astro check + build + link check + Lighthouse budget".

```
pnpm run stress            # all four presets
pnpm run stress -- fresh   # one preset
```

Per preset it runs: `astro check` (once) → build → internal link check → **og:image
resolution check** → Lighthouse (perf ≥90, a11y =100, best-practices ≥95, SEO =100) →
colour-contrast audit must pass outright → no horizontal overflow at 360/768/1440.

**The payload is never touched.** `src/lib/theme.ts` resolves the active preset from a
`DS_PRESET` environment variable, falling back to `theme.preset`. The previous approach
`sed`-edited `client/site.config.ts` and restored it afterwards, which left the repo on the
wrong preset twice when a run hit a command timeout. An invalid value fails loudly:

```
DS_PRESET="neon" is not a known preset.
Expected one of: stealth, fresh, chrome, bold.
```

The og:image check exists specifically because that bug survived phases 1–3 undetected: a
link checker only inspects `href`/`src`, and Lighthouse never fetches og:image, so a
completely broken share preview scored 100 across the board.

Verified both directions. Passing run:

```
  preset   page               perf  a11y  bp   seo  contrast  responsive  links c/b   og
  fresh    /                  96    100   100  100  pass      ok          3258/0      ok
  stealth  /auto-detailing/   97    100   100  100  pass      ok          3258/0      ok
  chrome   /                  96    100   100  100  pass      ok          3279/0      ok
  bold     /auto-detailing/   98    100   100  100  pass      ok          3258/0      ok
```

Negative test — a single wrong href in `Footer.astro` produced 66 broken links across the
build, was reported with the offending path, and exited 1. Exit codes confirmed: 0 on pass,
1 on fail.

New devDependencies: `lighthouse` 13.4.1 and `chrome-launcher` 1.2.1. The latter is a
transitive dependency of Lighthouse but pnpm does not hoist it, so it has to be declared.

## Motion

A `motion` motif drives duration, easing and travel distance, so the presets move
differently rather than sharing one feel:

| preset | character | duration | travel |
|---|---|---|---|
| `fresh` | calm | 700ms | 14px |
| `stealth` | sharp | 320ms | 8px |
| `chrome` | smooth | 560ms | 12px |
| `bold` | snappy (slight overshoot) | 420ms | 18px |

What animates: hero entrance (chip → headline → lede → CTAs → proof card, staggered
40–420ms), section reveal on scroll, and staggered grid/list children. FAQ disclosures ease
open where `interpolate-size` is supported. Nothing else — no parallax, no counters, no
scroll-jacking, and nothing that delays content appearing.

**Safety, which is the whole game here.** The visible finished state is always the default.
Every animation sits inside `@media (prefers-reduced-motion: no-preference)`, and the
scroll-driven ones additionally inside `@supports (animation-timeline: view())`. A browser
without support — Firefox today — and a visitor who prefers reduced motion both simply see
the page. Verified: no `opacity: 0` exists outside `@keyframes`, so no static rule can ever
hide content.

Verified empirically too: after scrolling the whole page, **0 of 26** animated elements
remained below 0.9 opacity, under both `no-preference` and `reduce`.

**Why the explicit reduced-motion gate.** The global rule near the top of `base.css` zeroes
`animation-duration`, which does *not* stop a view-timeline animation — its progress comes
from scroll position, not time. Relying on that rule would have left scroll animations
running for people who asked for no motion.

Only `opacity` and `transform` animate: compositor-driven, no layout effect, so this cannot
introduce layout shift. Confirmed by the stress gate — performance actually ticked up to
96–97 across the board and CLS was unaffected.

Bug caught during the build: `MOTION[t.motion]` should have been `MOTION[t.motif.motion]` —
`motion` lives inside the `motif` object. Failed the build immediately with a named error
rather than silently emitting `undefined` tokens.

## Carried forward

- `ghl.quoteUrl` is still a placeholder, deferred by the user.
- `Hero`'s `image` variant remains as the reduced-motion / no-video fallback.
- The `bold` preset uses Anton, which ships a single weight; `base.css` pins its headings
  to `font-weight: 400` so browsers cannot faux-bold it.
- Kleen's hero poster shows a person wearing another company's branding
  ("VELOCITY AUTO DETAILING"). It is the client's own live-site photo and fine for a
  fixture, but must not be reused for a real client.
