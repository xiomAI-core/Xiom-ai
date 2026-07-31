# syntax=docker/dockerfile:1
# Multi-stage build for xiom-api (pnpm monorepo)
# Cloud Run / image: xiom-api (legacy alias: axiom-api)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @xiom/api... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV OTEL_SERVICE_NAME=xiom-api
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

COPY --from=build /app /app

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
