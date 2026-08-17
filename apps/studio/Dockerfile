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

# 🛑 ADR-0078 C1 — THE CAPTURE CLI IS BUILT INTO THIS SAME IMAGE, ON PURPOSE.
# `@age/capture` is already IN this tree (the console imports
# `deployed-console-composition`), so a second image would be a second copy of
# the same code that could drift from the console's. ⚠️ `apps/capture/dist` is
# NOT tracked, so without this step the bin the entrypoint execs does not exist.
# 🚫 This adds no network reach and no secret: the capture container gets its
# boundary from `network_mode`, 🚫 never from anything baked here.
RUN pnpm --filter @age/capture build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /age

# 🛑 **BAKE THE PACKAGE MANAGER; 🚫 DO NOT FETCH IT AT START.** `corepack enable`
# alone leaves pnpm to be DOWNLOADED on first invocation, and this container has
# no route to the internet — `age-internal` carries AGE's store and nothing
# else. ⚠️ MEASURED: the first deployment crash-looped on
# `getaddrinfo EAI_AGAIN registry.npmjs.org`. That failure is evidence FOR D1,
# not against it, but the runtime must not depend on the reach it refuses.
#
# 🛑 **AND BAKE IT WHERE ANY UID CAN READ IT.** ⚠️ MEASURED, SECOND CRASH-LOOP:
# corepack's default home is the RUNNING USER's `~/.cache`, so with
# `user: 1001:1001` in the compose file — the uid that owns the operator's
# files — it resolved to `/.cache`, could not create it, and fell back to
# DOWNLOADING pnpm on a container with no route to the internet. The failure
# printed `EACCES` and then `EAI_AGAIN`, which reads like a network fault and is
# a permissions one. 🚫 The console must not depend on the uid it runs as.
ENV COREPACK_HOME=/opt/corepack
ENV HOME=/tmp
RUN mkdir -p /opt/corepack \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate \
  && chmod -R a+rX /opt/corepack

# ⚠️ **ROOT-OWNED AND WORLD-READABLE, 🚫 NOT OWNED BY THE RUNNING USER.** The
# console reads its own code whichever uid the deployment gives it (the owner of
# the operator's record — see the compose file), and the tree's modes come
# straight from the repo, which is already `a+rX`.
#
# 🚫 **DO NOT ADD `RUN chmod -R a+rX /age`.** ⚠️ MEASURED TWICE: a recursive
# chmod over the workspace — `node_modules` included — reset the deploy's SSH
# session mid-build both times, leaving a HALF-BUILT IMAGE that the previous
# container kept crash-looping in front of. Nothing here is written, and nothing
# here needs its owner changed.
COPY --from=build /age /age

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
