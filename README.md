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

## Deploying

Each client is a separate application on the host, all pointing at **the same repo and
branch**, differing only by `DS_CLIENT` and domain. The build is fully static, so
`DS_CLIENT` must be set at **build time** — a runtime env var does nothing.

Two things to know before the first deploy:

- **A push rebuilds every client** unless the platform can filter by changed path.
  Restrict each application to `src/**` plus its own `clients/<slug>/**` where
  supported, or disable auto-deploy for settled clients.
- **`_redirects` is a Netlify/Cloudflare format.** Serving `dist/` with nginx or Caddy
  ignores it, so migration 301s silently do nothing. Translate the file into the
  server's own config, or serve behind a CDN that understands it.

## Checks

```
pnpm check                 # types
pnpm build                 # schema validation, contrast, asset budgets
pnpm run stress -- fresh    # + links, og:image, Lighthouse, responsive overflow
pnpm run stress             # all four presets
```
