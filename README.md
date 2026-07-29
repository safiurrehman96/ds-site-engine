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
  site.config.ts        # facts: brand, contact, hours, GHL links, theme, SEO tokens
  _redirects            # optional 301s, staged into public/ by pnpm use
  assets/               # logo, hero video + poster, social image, page images
  content/
    home.md  about.md  faqs.md  booking.md  get-quote.md  booking-confirmed.md
    services/*.md  areas/*.md
    legal/                # optional authored Privacy/ToS; empty = generated template
```

1. `mkdir -p clients/<slug>` and copy an existing payload as the shape reference.
2. In `site.config.ts`, import the schema as `'../../src/config-schema'` — two levels
   up, because Vite resolves the symlink to the real path before resolving imports.
3. Drop assets in. Budgets are enforced at build: 1536KB hero video, 600KB per image.
4. `pnpm use <slug> && pnpm build`. Every missing field fails the build by name.

For a client arriving as a Notion export, run the importer first:

```
pnpm run import -- --client facts.json          # dry run: reports what will not map
pnpm run import -- --client facts.json --write  # emit the reviewed intermediate
```

It resolves `{{custom_values.*}}` merge fields, rewrites Notion links to site paths,
and reports what a human still has to place. It does **not** guess how prose maps onto
`packages` / `addons` / `processSteps` — that is authored, not inferred.

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
