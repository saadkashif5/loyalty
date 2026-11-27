# syntax=docker/dockerfile:1
#
# One Dockerfile for every deployable app. Pick one with --target:
#   docker build --target api .                         (API and worker)
#   docker build --target next --build-arg APP=web .    (web, admin or portal)
# See docs/deploy-hetzner.md.

# Node 22: the OpenTelemetry packages require 22.15 or newer.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies (only the manifests, so this layer is cached between builds)
FROM base AS deps
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY admin/package.json admin/
COPY portal/package.json portal/
COPY packages/brand/package.json packages/brand/
COPY packages/constants/package.json packages/constants/
COPY packages/types/package.json packages/types/
COPY packages/validation/package.json packages/validation/
# --ignore-scripts skips the root "prepare" (husky); nothing else needs install scripts.
RUN npm ci --ignore-scripts

# ---- API and worker
FROM deps AS api-build
COPY . .
RUN npm run build --workspace=api

# Production dependencies only; the shared @taptapsell/* packages are bundled by tsup.
FROM deps AS api-prod-deps
RUN npm ci --ignore-scripts --omit=dev --workspace=api

FROM base AS api
ENV NODE_ENV=production
COPY --from=api-prod-deps /app ./
COPY --from=api-build /app/api/dist ./api/dist
WORKDIR /app/api
# Payment receipts and exports; mount a volume here.
RUN mkdir -p storage && chown node:node storage
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]

# ---- Next.js apps (web, admin, portal)
FROM deps AS next-build
ARG APP
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_OUTPUT=standalone
COPY . .
RUN test -n "$APP" || (echo "Pass --build-arg APP=web|admin|portal" && exit 1)
RUN npm run build --workspace=$APP && mkdir -p $APP/public

FROM base AS next
ARG APP
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    APP=$APP
COPY --from=next-build --chown=node:node /app/$APP/.next/standalone ./
COPY --from=next-build --chown=node:node /app/$APP/.next/static ./$APP/.next/static
COPY --from=next-build --chown=node:node /app/$APP/public ./$APP/public
USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node $APP/server.js"]
