# ds-site-engine

One Astro engine, many client sites. The engine is `src/`; each client is a payload
directory under `clients/`. No client's words live in engine files — if a string is
visible on a page, it comes from the payload's markdown or `site.config.ts`.

## Selecting a client

`client/` is a **symlink**, not a directory. It points at whichever payload is active:

```
pnpm use kleen        # repoint client/ → clients/kleen
pnpm use              # re-link from DS_CLIENT, or keep the current link
```

`dev`, `build`, `preview`, `check` and `stress` all re-establish the link first (the
`pre*` scripts in package.json), so a stale link cannot silently build the wrong
client. In CI, set `DS_CLIENT` instead of running `pnpm use`:

```
DS_CLIENT=kleen pnpm build
```

Why a symlink rather than an env-driven path: thirty engine files import the payload
by relative path, and three `import.meta.glob` calls hardcode `client/assets/**`.
Vite requires those glob patterns to be static literals, so the mount point has to
stay put — the link moves instead.

## Adding a client

```
clients/<slug>/
  source/
    intake.json         # THE INPUT — every fact the site needs, in one file
    Website Pages/      # the content export, where one exists
  site.config.ts        # generated from intake.json; plain data, imports nothing
  _redirects            # optional 301s, staged into public/ by pnpm use
  assets/               # logo, hero video + poster, social image, page images
  content/
    home.md  about.md  faqs.md  booking.md  get-quote.md  booking-confirmed.md
    services/*.md  areas/*.md
    legal/              # optional authored Privacy/ToS; empty = generated template
```

**1. Fill the intake.** Copy `scripts/intake.template.json` to
`clients/<slug>/source/intake.json`. It covers business facts, contact and NAP, service
area, hours, socials, GHL calendars and forms, tracking, theme, legal, the full page
inventory, and the site-level assets — everything `site.config.ts` and the merge-field
resolver need. Field docs live in `scripts/intake-schema.mjs`.

Anything not yet known is `null` — never a guess, and never a placeholder that looks
real. An invented phone number passes validation and ships; a null one fails the build
until someone chases it.

**2. Check it.**

```
pnpm run intake <slug>      # or --all
```

Separates three things: schema errors (the file is wrong), facts still needed before the
site can build, and optional fields deliberately left empty.

**3. Import the content**, where it arrived as an export:

```
pnpm run import <slug>              # dry run: reports what will not map
pnpm run import <slug> -- --write   # emit the reviewed intermediate to .import/
```

It resolves `{{custom_values.*}}` merge fields from the same intake file, rewrites Notion
links to site paths, and reports what a human still has to place. It does **not** guess
how prose maps onto `packages` / `addons` / `processSteps` — that is authored, not
inferred, because a wrong guess there builds cleanly and reads like nonsense.

**4. Author the payload**, drop the assets in (budgets are enforced at build: 1536KB
hero video, 600KB per image), then `pnpm use <slug> && pnpm build`. Every missing or
malformed field fails the build by name.

### Building before the facts arrive

Onboarding rarely completes before someone wants to see the site. Two supports for that:

```
pnpm run placeholders <slug>   # generate stand-in logo, hero video, poster, images
```

and stand-in values in `site.config.ts` containing the string `PLACEHOLDER`. Both are
deliberately, visibly fake — flat grey images, `example.com` booking URLs, a footer
that reads `PLACEHOLDER, NJ 00000`. A plausible stand-in survives review and reaches
production; an ugly one cannot.

Every placeholder is listed on each build, and **`DS_STRICT=1` turns that warning into
a build failure** — set it in any deploy pipeline. `intake.json` stays the honest
record: a field that is null there has not been supplied, whatever the config says.

## Deploying

Each client is a separate application on the host (Dokploy), all pointing at **the same
repo**, differing only by `DS_CLIENT`, git ref, and domain. The build is fully static, so
`DS_CLIENT` must be set at **build time** — a runtime env var does nothing.

### One engine, but a live site never moves on its own

A shipped site is a static `dist/` on the server. An engine change cannot alter it; only
a rebuild can. So the isolation between clients lives in **what each application builds
from**, and each one is pinned to a tag rather than tracking a branch head:

```
git tag jetspa/v1        # cut when the site goes live
```

- Each Dokploy application's ref is that tag. **Auto-deploy stays off.**
- Push whatever you like to `master`; JetSpa keeps building `jetspa/v1` indefinitely.
- Updating a client is a deliberate act: cut `jetspa/v2`, bump that one application's
  ref. One client at a time, on your schedule — never as a side effect of an engine
  commit.

A finished site is therefore frozen by the ref, not by convention.

### Why not a copy of the engine per client

Because every fix would need making N times, and would get made once. Concrete case: a
bulleted `Prose` block inside a copy-only `SplitSection` inherited `text-align: center`,
which stranded the list markers away from their text. One fix in `src/components/Prose.astro`
covers every client. Forked, it would be live on four sites nobody looked at again.

Divergence that is genuinely per-client belongs in the payload — preset, accent, config,
content already cover most of it. If a client ever needs a bespoke section, add
`clients/<slug>/overrides/Foo.astro`, resolved ahead of `src/components/Foo.astro`, rather
than branching the engine. One mechanism, one place to look. (Not built yet — no client
has needed it.)

### Bumping a pin safely

Pinned deploys have exactly one failure mode: nobody dares bump the pin, and clients rot
on a months-old engine, missing accessibility, contrast, and SEO fixes. The answer is to
make *"what would change if I bumped this?"* a command rather than a guess.

**Not built yet — `scripts/release-diff.mjs`:** build a client at its pinned tag and at
`HEAD`, then diff the extracted visible text per route plus page and asset weight, and
print which pages would move. Empty output means the bump is mechanically safe; anything
else gets read before promoting. This generalises the text-diff used as the regression
check while making the engine client-shape-agnostic — comparing rendered text rather than
bytes, since markup and hashed filenames churn for reasons that do not reach the page.
`pnpm run stress` already covers the rest (links, og:image, contrast, Lighthouse,
responsive overflow). Worth writing before the second client goes live, which is the
first time a pin bump has stakes.

### Also before the first deploy

- **Set `DS_STRICT=1`** in the pipeline, so a payload still carrying `PLACEHOLDER` values
  fails the build instead of shipping.
- **`_redirects` is a Netlify/Cloudflare format.** Serving `dist/` with nginx or Caddy
  ignores it, so migration 301s silently do nothing. Translate the file into the
  server's own config, or serve behind a CDN that understands it.
- **Path filtering is not a substitute for pinning.** Restricting an application to
  `src/**` plus its own `clients/<slug>/**` still rebuilds every client on any `src/`
  commit — which is the thing being avoided here.

## Theme

A client's whole design decision is `theme.preset` plus `theme.accentColor`. Everything
else — palette, type, radii, dividers, card and button treatment, hero composition,
motion — comes from the preset.

| preset | surfaces | character |
| --- | --- | --- |
| `fresh` | light | Space Grotesk, curved dividers, pill buttons, split hero |
| `stealth` | light, near-black bands | Oswald condensed uppercase, square buttons, full-bleed hero |
| `chrome` | light | Sora, overlapping cards, centred hero |
| `bold` | light | Anton, hard offset shadows, poster-card hero |
| `noir` | **near-black** | stealth's language inverted — for a *light* accent |

**Pick `noir` when the brand colour is light** — brass, champagne, bronze, pale gold.
This is not a taste call, it is arithmetic: WCAG AA wants 3:1 for an accent fill against
the page, and brass `#c6a46c` manages 2.12:1 on `stealth`'s `#f3f3f4` versus 8.32:1 on
`#0c0c0c`. `assertAccentContrast` fails the build rather than shipping it, so a light
accent on a light preset is not a thing you can talk the engine into.

Two things are derived per accent rather than authored, so most accents just work:
`--ds-on-accent` (the label on an accent fill) flips to dark when white would be
illegible, and `--ds-accent-ink` moves toward or away from white depending on whether
the preset's surfaces are dark or light.

`/styleguide/{preset}` renders the payload under any preset for comparison, and reports
in-page when the accent would not pass there — only the shipping preset fails the build.

## Checks

```
pnpm check                 # types
pnpm build                 # schema validation, contrast, asset budgets
pnpm run stress -- fresh    # + links, og:image, Lighthouse, responsive overflow
pnpm run stress             # all five presets
```

A sweep skips any preset the payload's accent cannot meet AA under, and says so. That is
reported rather than counted as a failure: an accent only has to pass on the preset its
client ships.
