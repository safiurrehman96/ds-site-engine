# One image per client application in Dokploy: same repo, same Dockerfile,
# differing only by the DS_CLIENT build arg (and the git ref the app is pinned to).
#
#   docker build --build-arg DS_CLIENT=kleen -t ds-kleen .
#
# The site is fully static, so everything client-specific happens in the build
# stage; the runtime stage is nginx serving dist/.

FROM node:24-alpine AS build

ARG DS_CLIENT
RUN test -n "$DS_CLIENT" || (echo "DS_CLIENT build arg is required" && exit 1)

# A payload still carrying PLACEHOLDER values must fail the build, never ship.
ENV DS_CLIENT=$DS_CLIENT \
    DS_STRICT=1 \
    CI=1

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
# _redirects is a Netlify/Cloudflare format nginx ignores — translate it into
# real rewrite rules baked into the image.
RUN node scripts/redirects-to-nginx.mjs clients/$DS_CLIENT/_redirects /app/redirects.conf


FROM nginx:1.29-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/redirects.conf /etc/nginx/snippets/redirects.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
