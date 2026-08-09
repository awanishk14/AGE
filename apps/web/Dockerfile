# syntax=docker/dockerfile:1
# AGE Web (Next.js) — multi-stage build
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
# ⚠️ NEXT_PUBLIC_* IS INLINED AT BUILD TIME, NOT READ AT RUNTIME — the demo page
# is a client component, so the browser gets whatever value was compiled in.
# 🚫 Setting this as a runtime `environment:` entry does nothing at all.
# ⚠️ The deployed composition passes '/api', a SAME-ORIGIN relative path, so the
# image carries no hostname and the browser never leaves the terminator.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @age/web... build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
