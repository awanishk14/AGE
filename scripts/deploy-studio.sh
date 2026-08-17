#!/usr/bin/env bash
#
# Deploy AGE Studio to the VPS AS A CONTAINER — ADR-0076 D1–D7.
#
# ─────────────────────────────────────────────────────────────────────────────
# 🛑 WHAT CHANGED, AND WHY THIS SCRIPT NO LONGER REFUSES A PROXY.
#
# This script used to install NO reverse proxy, publish NO port and write NO
# vhost, because `apps/studio` had no sign-in: exposing it would have published
# an UNAUTHENTICATED console. ADR-0074 slices 2/3 gave it a verified-session
# boundary (measured on this VPS: a cross-organisation token is refused with the
# same `refused=1` as garbage, logout writes `revokedAt`, and the old cookie is
# then refused), so that reason is spent. 🚫 The old refusals were not dropped
# silently — the ADR records the change, and the guards in
# `packages/studio-shell/src/studio-bind-configuration.spec.ts` were rewritten
# to hold the crossings that ARE still crossings.
#
# 🛑 THE ONE THE OWNER ASKED FOR. Every other product on this host is
# containerised specifically so a compromise of one cannot reach the others. The
# console was the last component of any product still running on the host, where
# `IPAddressAllow=127.0.0.1/32` cannot express a PORT rule — so it could open a
# peer's PostgreSQL published on loopback. ⚠️ THAT WAS MEASURED, NOT ASSUMED.
# ADR-0076 D1 removes the reach rather than filtering it.
#
#   studio  → age-internal (AGE's own store) AND NOTHING ELSE.
#           → published on 127.0.0.1:3100 ONLY.
#
# ⚠️ AN EARLIER DRAFT BUILT AN AGE-OWNED nginx PUBLISHING 80/443 AND PUBLISHED
# NOTHING FOR THE CONSOLE. 🚫 That proxy could not exist: the host's own nginx
# already binds both ports and serves five peer vhosts. ADR-0076 §0.4b records
# the measurement. The host nginx is the public terminator; it has no Docker
# network membership, so it still has NO ROUTE TO ANY DATABASE.
#
# ⚠️ Nothing here is defaulted. Every address, path and workspace location is
# named by the operator, and the script refuses rather than guess.
#
# 🚫 NO CREDENTIAL EVER REACHES A COMMAND LINE, A BUILD ARGUMENT OR A LOG (D6).

set -euo pipefail

require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "REFUSED: ${name} is not set." >&2
    echo "  Nothing is defaulted here. Set it and run again." >&2
    exit 2
  fi
}

require AGE_VPS_HOST
require AGE_VPS_USER
require AGE_VPS_PORT
require AGE_VPS_PATH

# ⚠️ The operator's own data locations ON THE VPS, outside the checkout.
# ADR-0054 D2/D3: an operator file's path is never defaulted, and the workspace
# must not live inside the repository. ⚠️ ADR-0076 D5 bind-mounts exactly these
# two, READ-ONLY, and nothing else.
require AGE_VPS_DISCOVERY_WORKSPACE
require AGE_VPS_CLIENT_RECORD_FILE

case "$AGE_VPS_DISCOVERY_WORKSPACE" in
  "$AGE_VPS_PATH"*)
    echo "REFUSED: the discovery workspace is inside the checkout." >&2
    echo "  ${AGE_VPS_DISCOVERY_WORKSPACE} is under ${AGE_VPS_PATH}." >&2
    echo "  A deploy would then rsync over a real business's answers." >&2
    exit 2
    ;;
esac

SSH=(ssh -p "$AGE_VPS_PORT" "${AGE_VPS_USER}@${AGE_VPS_HOST}")
HOST_ENV="/etc/age-studio/age-studio.env"
CONTAINER_ENV="/etc/age-studio/age-studio.container.env"

# ⚠️ ADR-0077 D2/D3 — EVERY ROOT OPERATION BELOW IS A FIXED-ARGUMENT WRAPPER.
# 🛑 The deploy account is not in the `docker` group and has no unrestricted
# sudo, because both are root by another name (`docker run -v /:/host`). It may
# run exactly these four programs, each of which chooses its own paths.
# 🚫 Do not add a `sudo docker`, a `sudo tee` or a `sudo sh -c` back here.
WRAPPER_COMPOSE_UP='/usr/local/sbin/age-deploy-compose-up'
WRAPPER_DERIVE_ENV='/usr/local/sbin/age-deploy-derive-env'
WRAPPER_PROBE='/usr/local/sbin/age-deploy-docker-probe'

# 🛑 THE WRAPPER COMPOSES FROM A LITERAL CHECKOUT PATH, so a deploy that copied
# the repository somewhere else would build the wrong tree — silently, because
# `up -d --build` would succeed against whatever is at the wrapper's own path.
# ⚠️ ADR-0077 D7: rolling back to the previous identity means deploying from the
# PRIOR COMMIT, whose scripts do not use wrappers — 🚫 not relaxing this.
WRAPPER_CHECKOUT='/home/age-deploy/age'
if [ "$AGE_VPS_PATH" != "$WRAPPER_CHECKOUT" ]; then
  echo "REFUSED: AGE_VPS_PATH is '${AGE_VPS_PATH}', but the root wrapper builds" >&2
  echo "  ${WRAPPER_CHECKOUT}. Deploying would build a tree nobody updated." >&2
  exit 2
fi

echo "==> Checking the host answers, and that AGE's containers are there"
# 🚫 NOT `docker --version`: the deploy account cannot reach the Docker socket at
# all, and that is the property ADR-0077 exists to create. The wrapper reports
# AGE's own two containers and nothing else on this shared host.
"${SSH[@]}" "sudo -n ${WRAPPER_PROBE} ps"

echo "==> Copying the repository (🚫 never the operator's workspace, 🚫 never .env)"
# ⚠️ THE FALLBACK IS NOT A CONVENIENCE. `rsync` is absent from a stock Git Bash
# on Windows, which is where this repository is developed. `git archive` ships
# ONLY TRACKED FILES, so it excludes the untracked handover documents, every
# `.env`, and `node_modules` by construction rather than by a list somebody has
# to remember to extend. 🚫 It deploys `HEAD`, never the working tree — an
# uncommitted change must not be able to reach a server.
if ! command -v rsync >/dev/null 2>&1; then
  echo "    (rsync absent locally — shipping tracked files at HEAD instead)"
  git -C "$(git rev-parse --show-toplevel)" archive --format=tar HEAD |
    "${SSH[@]}" "rm -rf '${AGE_VPS_PATH}' && mkdir -p '${AGE_VPS_PATH}' && tar -x -C '${AGE_VPS_PATH}'"
else
rsync -az --delete \
  -e "ssh -p ${AGE_VPS_PORT}" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.turbo' \
  --exclude '.nx' \
  --exclude 'dist' \
  --exclude '*.env' \
  --exclude '.env*' \
  --exclude 'CLAUDE.md' \
  --exclude 'docs/AGE_STANDING_CONTEXT.md' \
  --exclude 'docs/PROJECT_STATUS_HANDOFF.md' \
  ./ "${AGE_VPS_USER}@${AGE_VPS_HOST}:${AGE_VPS_PATH}/"
fi

echo "==> Deriving the container's env file from the provisioned one"
# 🛑 **THERE IS NO LONGER A DIFFERENCE TO DERIVE** — ADR-0078 C3. The host
# service once reached AGE's store through a loopback publication that does not
# exist inside the container's namespace, so this step rewrote the authority.
# C3 removed that publication, and provisioning now writes the container route
# directly, so the wrapper COPIES and then VERIFIES rather than substituting.
# ⚠️ The step is kept because the verification is: a provisioned file predating
# C3 must FAIL here rather than start a console pointed at a port that is gone.
# 🚫 The value is never read back, printed, or carried on a command line (D6).
#
# 🚫 If the provisioned file is missing, this REFUSES. ADR-0061 A6 item 2: a
# deployment that starts without its secrets is a deployment nobody knows is
# misconfigured, and there is no default and no generated substitute.
#
# 🛑 ADR-0077 D3 WRAPPER 2. This used to be `sudo sh -c "sed … > …"`, which is a
# ROOT SHELL and not an operation: a caller-supplied `sed` expression or output
# path is an arbitrary root write. Both paths, the substitution and the
# resulting ownership are now literals inside the wrapper, which takes no
# arguments at all. 🚫 The refusals did not move — they live in the wrapper.
"${SSH[@]}" "sudo -n ${WRAPPER_DERIVE_ENV}"

echo "==> Building and starting the container (🚫 no published console port)"
# ⚠️ `prisma:generate` RUNS BEFORE `next build` INSIDE THE IMAGE, and the order
# is the point — see `apps/studio/Dockerfile`. Next traces `@prisma/client` into
# `.next/server/chunks/*` at BUILD time; without a generated client at that
# moment it bundles the stub, and the deployment then serves `/sign-in` and
# redirects every protected route correctly, but throws the instant a real
# session is presented. That failure was MEASURED on this VPS while every test
# in the repository was green.
#
# 🛑 THE UID IS DERIVED FROM THE RECORD FILE, 🚫 NOT CHOSEN AND 🚫 NOT DEFAULTED.
# The operator's record is `0600` and their workspace `0700`; the image's own
# user is `node`, whose uid belongs to a DIFFERENT REAL ACCOUNT on this shared
# host. ⚠️ MEASURED: both mounts present, every read `Permission denied`, and the
# console then said — honestly — that it had found no businesses.
# 🚫 The repair is not `chmod o+r` on a real business's data. The one uid that is
# certainly right is the one that owns the file the console must open.
#
# 🛑 ADR-0077 D3 WRAPPER 1. The uid derivation moved INTO the wrapper, and that
# is the point: a caller-supplied uid is a caller-supplied privilege, so the
# deploy account no longer names it. The rule is unchanged — the console runs as
# the owner of the record file, and the wrapper refuses uid 0.
"${SSH[@]}" "sudo -n ${WRAPPER_COMPOSE_UP}"

echo "==> The console must actually be SERVING, 🚫 not merely started"
# 🛑 **`up -d` SUCCEEDS FOR A CONTAINER THAT IS CRASH-LOOPING.** ⚠️ MEASURED: a
# permissions fault at start put the console in `restarting` and this script
# reported a clean deployment anyway — the same failure class as a CI job that
# executes no steps. 🚫 `State.Running` alone is not enough either: a restarting
# container is "running" for part of every cycle. The question is whether the
# one route an unauthenticated caller may reach ANSWERS.
"${SSH[@]}" "set -euo pipefail
  for attempt in \$(seq 1 30); do
    if sudo -n ${WRAPPER_PROBE} exec-probe age-studio sign-in 2>/dev/null; then
      echo '    serving: /sign-in answers inside the container'
      exit 0
    fi
    sleep 4
  done
  echo 'REFUSED: the console never served /sign-in. It is not deployed.' >&2
  sudo -n ${WRAPPER_PROBE} logs age-studio >&2 || true
  exit 1"

echo "==> D7: proving the boundary FROM INSIDE THE RUNNING CONTAINER"
# 🛑 **THE OWNER ASKED FOR REACHABILITY, 🚫 NOT FOR AN APPLICATION QUERY THAT
# RETURNS NOTHING.** A query can fail for a dozen reasons that have nothing to do
# with the network. This opens a RAW TCP CONNECTION to each address and reports
# what the kernel in that namespace actually permits.
#
# ⚠️ AGE's own store must be REACHABLE. A deployment that denied everything would
# pass a naive "nothing is reachable" check and be entirely broken.
# 🛑 ADR-0077 D3 WRAPPER 4. The probe text is FIXED INSIDE THE WRAPPER, not
# piped from here — 🚫 the deploy account does not choose what runs in the
# container, even though that text executes as uid 1001 in an unprivileged
# namespace and would grant nothing today. "Harmless today" is not a property
# that survives an image change.
"${SSH[@]}" "sudo -n ${WRAPPER_PROBE} exec-probe age-studio peer-reachability"

echo "==> Confirming the console is published on LOOPBACK ONLY (D3)"
# 🛑 THE CHECK THAT MATTERS, AND IT IS NOT "IS IT UP". A `ports:` key reading
# `3100:3100` starts exactly as cleanly and puts the console on the public
# internet with no TLS and no session boundary in front of it. So the test is
# on the ADDRESS: every listener on 3100 must be a loopback one.
"${SSH[@]}" "public=\$(ss -ltn 2>/dev/null | awk '\$4 ~ /:3100\$/ {print \$4}' | grep -v '^127\.0\.0\.1:' || true)
  if [ -n \"\$public\" ]; then
    echo \"    FAIL: 3100 is published on a non-loopback address: \$public\" >&2
    exit 1
  fi
  if ! ss -ltn 2>/dev/null | awk '\$4 ~ /:3100\$/' | grep -q '127\.0\.0\.1:3100'; then
    echo '    FAIL: nothing is published on 127.0.0.1:3100 — the host nginx could not reach the console.' >&2
    exit 1
  fi
  echo '    ok   127.0.0.1:3100 only'"

cat <<NEXT

==> Done. The console runs in a container published on host loopback only.

    ⚠️ It has NO ROUTE TO ANY PEER DATABASE — proven above from inside the
    running container, not inferred from a query that returned nothing. TLS and
    the public hostname are \`scripts/expose-studio-public.sh\`.

    ⚠️ THE TUNNEL IS NO LONGER THE AUTHENTICATION, AND NO LONGER THE TRANSPORT.
    The console has a real boundary: every route but the sign-in door requires a
    session token provisioned as an act, verified against a row in this
    deployment's store, and revoked on sign-out.

    ⚠️ THE CONTAINER WILL NOT START WITHOUT AGE_STUDIO_ORGANIZATION_ID. It is
    written into ${HOST_ENV} by scripts/provision-studio-database.sh and derived
    into ${CONTAINER_ENV} above. It is the RLS lookup scope, 🚫 not an
    authorization: every entitlement decision is taken from the session row.
NEXT
