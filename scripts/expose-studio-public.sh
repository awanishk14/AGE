#!/usr/bin/env bash
#
# AGE Studio — the public bind (ADR-0074 §7 slice 4).
#
# 🛑 **THIS IS THE SLICE THE PRODUCT OWNER HELD BACK UNTIL LAST**, in their own
# words: *"Do not expose the Studio unauthenticated even temporarily."* So this
# script REFUSES TO EXPOSE ANYTHING until it has checked, on the box, that the
# console it is about to publish actually has a boundary:
#
#   1. the service is running,
#   2. it is bound to 127.0.0.1 AND NOWHERE ELSE,
#   3. an unauthenticated request to a protected route is REDIRECTED, not served,
#   4. a garbage credential is refused.
#
# ⚠️ **THOSE FOUR ARE CHECKED FIRST, EVERY RUN, INCLUDING RE-RUNS.** A boundary
# that was true the day it shipped is not evidence about the process running now.
#
# 🚫 **IT TAKES NO SECRET AND SETS NONE.** Nothing here reaches a database, mints
# a token or reads a credential file, so there is no value that could land in a
# remote argv (the defect #350 removed from the provisioning script). The only
# only input is a hostname.
#
# ⚠️ Usage, from the repository root, with ssh able to reach the box:
#
#     AGE_VPS_HOST=vps AGE_VPS_USER=age-deploy AGE_VPS_PORT=22 \
#     AGE_PUBLIC_HOST=age.digitaldadi.agency \
#     bash scripts/expose-studio-public.sh
#
set -euo pipefail

AGE_VPS_HOST="${AGE_VPS_HOST:?the VPS host}"
AGE_VPS_USER="${AGE_VPS_USER:?the VPS user}"
AGE_VPS_PORT="${AGE_VPS_PORT:-22}"
AGE_PUBLIC_HOST="${AGE_PUBLIC_HOST:?the public hostname, e.g. age.digitaldadi.agency}"
# 🚫 NO `AGE_ACME_EMAIL`. Certificate issuance left this script with ADR-0077 D4
# — it is an owner act, and there is nothing here that could need one.
AGE_STUDIO_PORT="${AGE_STUDIO_PORT:-3100}"

SSH=(ssh -p "$AGE_VPS_PORT" "${AGE_VPS_USER}@${AGE_VPS_HOST}")
VHOST_SOURCE="$(dirname "$0")/../deploy/vps/nginx/age.digitaldadi.agency.conf"

# ⚠️ The same one-way street as the provisioning script: assignments go DOWN THE
# PIPE ahead of the program, never into a remote command line. There is no secret
# in this script today, and this is how it stays true if one ever appears.
remote() {
  {
    local assignment
    for assignment in "$@"; do
      printf 'export %s=%q\n' "${assignment%%=*}" "${assignment#*=}"
    done
    cat
  } | "${SSH[@]}" bash -s
}

echo "==> 1/4 The console must already have a boundary. Checking it, on the box."

remote AGE_STUDIO_PORT="$AGE_STUDIO_PORT" <<'REMOTE'
set -euo pipefail

# ⚠️ THE CONSOLE IS A CONTAINER SINCE ADR-0076 D1, 🚫 NO LONGER A SYSTEMD UNIT.
# This asked `systemctl is-active age-studio`, which on the new deployment
# answers "inactive" for a console that is running perfectly — a refusal that
# would read exactly like a broken deployment.
# ⚠️ ADR-0077 D3 WRAPPER 4 — the deploy account cannot reach the Docker socket.
if ! sudo -n /usr/local/sbin/age-deploy-docker-probe inspect age-studio 2>/dev/null | grep -q '^true '; then
  echo "REFUSED: the age-studio container is not running. There is nothing to publish." >&2
  exit 1
fi

# 🛑 LOOPBACK, AND NOWHERE ELSE. If the console were already listening on a
# public interface, putting a proxy in front of it would decorate a door that
# nobody has to use — the exact shape ADR-0061 A6 refuses by name.
#
# ⚠️ UNCHANGED BY CONTAINERISATION, AND THAT IS THE POINT: the publication
# `127.0.0.1:3100:3100` appears here exactly as the host bind did, so this check
# still reads the thing that decides who can reach the console. 🚫 It would NOT
# be satisfied by `3100:3100`, which is the mistake worth catching.
listening="$(ss -ltn | awk -v p=":${AGE_STUDIO_PORT}$" '$4 ~ p {print $4}')"
if [ "$listening" != "127.0.0.1:${AGE_STUDIO_PORT}" ]; then
  echo "REFUSED: the console is listening on '${listening}', not 127.0.0.1:${AGE_STUDIO_PORT} alone." >&2
  exit 1
fi

base="http://127.0.0.1:${AGE_STUDIO_PORT}"

# ⚠️ A PROTECTED ROUTE, UNAUTHENTICATED, MUST REDIRECT — 🚫 not 200, and 🚫 not
# 500. A 200 here means the page rendered for a caller with no session.
for path in / /businesses /diagnostics; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${base}${path}")"
  if [ "$code" != "307" ] && [ "$code" != "302" ] && [ "$code" != "303" ]; then
    echo "REFUSED: ${path} answered ${code} to an unauthenticated request." >&2
    exit 1
  fi
done

# ⚠️ And a garbage credential must be REFUSED at the door.
refusal="$(curl -sS -o /dev/null -w '%{redirect_url}' -X POST \
  --data-urlencode 'token=not-a-real-token' "${base}/sign-in/submit")"
case "$refusal" in
  *"/sign-in?refused="*) : ;;
  *) echo "REFUSED: a garbage token did not produce a refusal (got '${refusal}')." >&2; exit 1 ;;
esac

echo "    boundary confirmed: loopback only, protected routes redirect, bad token refused"
REMOTE

# ─────────────────────────────────────────────────────────────────────────────
# 🛑 STEPS 2 AND 3 ARE OWNER ACTS AND ARE NO LONGER IN THIS SCRIPT (ADR-0077 D4).
#
# Bringing up the plaintext :80 half and ISSUING a certificate both need root
# that `age-deploy` does not have and must not be given: `sudo certbot <free
# arguments>` is unrestricted root, because `--deploy-hook` runs arbitrary
# commands as root. 🚫 No wrapper was added for it, on purpose.
#
# ⚠️ THEY ARE ONE-TIME BOOTSTRAP ACTS, ALREADY PERFORMED FOR
# `age.digitaldadi.agency`. Renewal is `certbot.timer`, on the system schedule,
# as root — the deploy identity is not part of it. A NEW hostname is issued by
# the owner, by hand, and 🚫 not by a deploy step.
#
# If the certificate is absent, step 4 below does not guess: the wrapper's own
# `nginx -t` fails on the missing file and it RESTORES the previous vhost.
# ─────────────────────────────────────────────────────────────────────────────

echo "==> 2/4 Installing the real vhost (TLS, headers, proxy to loopback)."

# ⚠️ The file is piped, so what runs on the box is byte-for-byte the file in the
# repository. 🚫 There is no second copy of these rules to drift.
# 🛑 ADR-0077 D3 WRAPPER 3. `sudo tee "$VARIABLE"` permitted writing ANY peer's
# vhost — a route to serving a peer's hostname from an AGE-controlled upstream.
# The hostname and the destination are literals inside the wrapper now; the body
# still arrives on stdin, so what runs on the box is byte-for-byte the file in
# the repository. The wrapper runs `nginx -t` and RESTORES on failure.
"${SSH[@]}" "sudo -n /usr/local/sbin/age-deploy-nginx-apply" < "$VHOST_SOURCE"

echo "==> 3/4 Re-checking the things the exposure could have changed."

remote AGE_STUDIO_PORT="$AGE_STUDIO_PORT" <<'REMOTE'
set -euo pipefail

# 🛑 THE CONSOLE MUST STILL BE ON LOOPBACK. Publishing it through a proxy must
# not have moved it; if this ever fails, the port is reachable without the proxy
# and every header and redirect above is decoration.
listening="$(ss -ltn | awk -v p=":${AGE_STUDIO_PORT}$" '$4 ~ p {print $4}')"
if [ "$listening" != "127.0.0.1:${AGE_STUDIO_PORT}" ]; then
  echo "REFUSED: after exposure the console is listening on '${listening}'." >&2
  exit 1
fi

# 🛑 AND THE DATABASE MUST STILL BE PRIVATE. AGE's own store publishes to
# 127.0.0.1 only (ADR-0075); a peer's store is none of AGE's business either way.
if ss -ltn | grep -qE '^\S+\s+\S+\s+\S+\s+(0\.0\.0\.0|\*|\[::\]):5442'; then
  echo "REFUSED: AGE's database is listening on a public interface." >&2
  exit 1
fi

# 🛑 AND THE CONSOLE MUST STILL HAVE NO ROUTE TO A PEER'S STORE (ADR-0076 D7).
# ⚠️ THIS IS THE MOMENT IT MATTERS MOST: the console has just become reachable
# from the internet, so a defect in it is now reachable from the internet too.
# 🚫 A raw TCP connect, 🚫 not an application query that returned nothing.
# 🛑 ADR-0077 D3 WRAPPER 4 — the probe text is FIXED INSIDE THE WRAPPER.
sudo -n /usr/local/sbin/age-deploy-docker-probe exec-probe age-studio peer-reachability

echo "    console still loopback-only; database still private"
REMOTE

echo "==> 4/4 Done."
echo
echo "    https://${AGE_PUBLIC_HOST}"
echo
echo "    🛑 THE TUNNEL IS NO LONGER REQUIRED, AND THE BOUNDARY IS UNCHANGED BY"
echo "    THAT. What protects the console is the verified session inside it —"
echo "    the same rows, the same refusals, the same revocation on sign-out."
echo "    🚫 This script added no second authentication and must never grow one."
