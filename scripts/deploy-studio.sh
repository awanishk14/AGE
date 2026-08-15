#!/usr/bin/env bash
#
# Put AGE Studio on a host the Product Owner can reach — WITHOUT crossing
# ADR-0057 D2.
#
# ─────────────────────────────────────────────────────────────────────────────
# 🛑 WHAT THIS SCRIPT DELIBERATELY DOES NOT DO.
#
# D2 (OX-INV-1): the console binds `127.0.0.1` or refuses to start — "no flag,
# no environment override, no degraded mode". The ADR then says, in its own
# words, that "a reverse proxy, an SSH tunnel, or a published container port in
# front of a loopback listener defeats it completely", and that "the operator
# remains responsible for the rest".
#
# So this script installs NO reverse proxy, publishes NO port, opens NO firewall
# rule and writes NO nginx/caddy site. The console listens on the VPS's own
# loopback, and the owner reaches it by forwarding a local port over SSH — the
# one arrangement where the person at the other end has already authenticated to
# the host. `apps/studio` has no sign-in of its own; an exposed console would be
# an unauthenticated console, which is a different product decision and needs
# its own `Proposed` ADR.
#
# 🚫 DO NOT "just add nginx" to make the URL nicer. That is the crossing.
# 🚫 DO NOT add a Dockerfile — `apps/studio/next.config.mjs` refuses one by name.
#
# ⚠️ Nothing here is defaulted. Every address, path and workspace location is
# named by the operator, and the script refuses rather than guess — the same
# rule the console itself follows for `AGE_DISCOVERY_WORKSPACE`.

set -euo pipefail

require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "REFUSED: ${name} is not set." >&2
    echo "  Nothing is defaulted here. Set it and run again." >&2
    exit 2
  fi
}

# Where to put it. 🚫 No fallbacks: a wrong-host deploy is not recoverable by
# reading the script afterwards.
require AGE_VPS_HOST
require AGE_VPS_USER
require AGE_VPS_PORT
require AGE_VPS_PATH

# ⚠️ The operator's own data locations ON THE VPS, outside the checkout.
# ADR-0054 D2/D3: an operator file's path is never defaulted, and the workspace
# must not live inside the repository.
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
SERVICE="age-studio"

echo "==> Checking the host answers"
"${SSH[@]}" 'echo "    node $(node -v), pnpm $(pnpm -v)"'

echo "==> Copying the repository (🚫 never the operator's workspace, 🚫 never .env)"
# ⚠️ `--delete` keeps the remote checkout an exact copy — a file removed here
# must not linger there and get imported. The workspace lives outside this path
# (asserted above), so nothing of the operator's is in reach of it.
#
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

echo "==> Installing and building on the host"
"${SSH[@]}" "cd '${AGE_VPS_PATH}' && pnpm install --frozen-lockfile && pnpm --filter @age/studio build"

echo "==> Writing the service (loopback only)"
# ⚠️ The unit runs `pnpm --filter @age/studio start`, which is
# `next start -H 127.0.0.1 -p 3100`. 🚫 The host is NOT a variable here: the
# start command carries the pinned constant, and `boundHost()` asserts the same
# one. Two places, one policy, no override.
"${SSH[@]}" "sudo tee /etc/systemd/system/${SERVICE}.service >/dev/null" <<UNIT
[Unit]
Description=AGE Studio (operator console, loopback only)
After=network.target

[Service]
Type=simple
User=${AGE_VPS_USER}
WorkingDirectory=${AGE_VPS_PATH}
Environment=NODE_ENV=production
Environment=AGE_DISCOVERY_WORKSPACE=${AGE_VPS_DISCOVERY_WORKSPACE}
Environment=AGE_CLIENT_RECORD_FILE=${AGE_VPS_CLIENT_RECORD_FILE}
# 🛑 THE CREDENTIAL LIVES ON THE SERVER, NEVER IN THIS REPOSITORY.
# \`scripts/provision-studio-database.sh\` writes it root-owned, mode 600.
# ⚠️ NO LEADING \`-\`: an absent file must stop the service. ADR-0061 A6 item 2 —
# a deployment that starts without its secrets is a deployment nobody knows is
# misconfigured, and 🚫 there is no default and no generated substitute.
EnvironmentFile=/etc/age-studio/age-studio.env
ExecStart=/usr/bin/env pnpm --filter @age/studio start
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

"${SSH[@]}" "sudo systemctl daemon-reload && sudo systemctl enable --now ${SERVICE} && sudo systemctl restart ${SERVICE}"

echo "==> Confirming it is listening on loopback AND NOWHERE ELSE"
# 🛑 THE ONE CHECK THAT MATTERS. A console reachable off 127.0.0.1 is an
# unauthenticated console on the public internet. If this ever prints anything
# but a loopback address, stop the service before doing anything else.
"${SSH[@]}" "ss -ltnp 2>/dev/null | grep ':3100' || echo '    (nothing listening on 3100 yet — check: journalctl -u ${SERVICE} -n 50)'"

cat <<TUNNEL

==> Done. To open it, the Product Owner runs THIS on their own machine:

      ssh -N -L 3100:127.0.0.1:3100 -p ${AGE_VPS_PORT} ${AGE_VPS_USER}@${AGE_VPS_HOST}

    and then opens  http://127.0.0.1:3100  in a browser.

    🛑 THE TUNNEL IS NO LONGER THE AUTHENTICATION (ADR-0074 §7 slice 2). The
    console now has a real boundary: every route but the sign-in door requires a
    session token that was provisioned as an act, verified against a row in this
    deployment's store, and revoked on sign-out. Reaching the port is no longer
    enough to see anything.

    ⚠️ THE TUNNEL IS STILL THE TRANSPORT, AND STILL REQUIRED. The service is
    bound to 127.0.0.1 and 🚫 nothing is published: there is no port, no proxy
    and no vhost. The public bind, TLS and the boundary in front of it are
    ADR-0074 §7 slice 4, and the Product Owner's instruction stands until then —
    "do not expose the Studio unauthenticated even temporarily".

    ⚠️ THE UNIT WILL NOT START WITHOUT AGE_STUDIO_ORGANIZATION_ID. It is written
    into /etc/age-studio/age-studio.env by scripts/provision-studio-database.sh.
    It is the RLS lookup scope, 🚫 not an authorization: every entitlement
    decision is taken from the session row that comes back.
TUNNEL
