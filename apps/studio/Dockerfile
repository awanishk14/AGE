# AGE Studio — the console, containerised (ADR-0076 D1).
#
# 🛑 **THIS FILE EXISTS BECAUSE ADR-0076 D2 AMENDED OX-INV-1, EXPLICITLY.** Until
# 2026-08-16 `apps/studio/next.config.mjs` refused a Dockerfile BY NAME, and that
# refusal was right for the deployment it described: a container port published
# in front of a loopback listener defeats the invariant completely.
#
# ⚠️ **WHAT CHANGED IS THE BOUNDARY, 🚫 NOT THE RULE.** The amended invariant is
# that the console's listener is reachable only from an explicitly enumerated
# boundary. Here that boundary is an UNPUBLISHED Docker network: the compose
# service that runs this image declares **no `ports:` at all** (D3), so the
# listener is reachable only from the reverse proxy over an internal network —
# strictly stronger than the host-loopback bind it replaces, under which any
# process on a host shared with four other products could open `127.0.0.1:3100`.
#
# 🚫 **NO SECRET ENTERS AN IMAGE LAYER** (D6). There is no `ENV DATABASE_URL`,
# no `ARG` carrying a credential and no `.env` copied in. The database URL
# arrives at RUN time from an env file readable only by the deploy user.
# ⚠️ A `--build-arg` would be visible in `docker history`, which is the image's
# equivalent of #350's rule that a command line is public on that host.

FROM node:22-bookworm-slim AS build

# ⚠️ Prisma's engines need OpenSSL; the slim image does not carry it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /age
RUN corepack enable

# ⚠️ The whole workspace, on purpose. `@age/*` packages are TS-source ESM
# consumed by the bundler (§8), so a partial copy produces a build that
# typechecks and then fails to resolve at runtime.
COPY . .

RUN pnpm install --frozen-lockfile

# 🛑 **THE ORDER IS LOAD-BEARING AND WAS MEASURED**: the Prisma client must be
# generated before `next build`, or the build resolves a client that does not
# exist yet. 🚫 Do not collapse these two steps.
RUN pnpm --filter @age/persistence run prisma:generate
RUN pnpm --filter @age/studio build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /age
RUN corepack enable

COPY --from=build --chown=node:node /age /age

# 🚫 Not root. A compromise of the console is the threat ADR-0076 is about, and
# the container's own user is the last of the several boundaries between that
# compromise and anything else.
USER node

ENV NODE_ENV=production

# ⚠️ `start:container` binds `0.0.0.0` — of THIS NAMESPACE, which is reachable
# only from the networks the compose file attaches. 🚫 It is NOT interchangeable
# with `start`, and the guard in `studio-bind-configuration.spec.ts` refuses it
# unless the compose service publishes no ports.
CMD ["pnpm", "--filter", "@age/studio", "start:container"]
