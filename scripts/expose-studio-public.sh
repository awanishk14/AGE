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
# inputs are a hostname and an email address for the certificate authority.
#
# ⚠️ Usage, from the repository root, with ssh able to reach the box:
#
#     AGE_VPS_HOST=vps AGE_VPS_USER=drishti AGE_VPS_PORT=22 \
#     AGE_PUBLIC_HOST=age.digitaldadi.agency \
#     AGE_ACME_EMAIL=someone@example.com \
#     bash scripts/expose-studio-public.sh
#
set -euo pipefail

AGE_VPS_HOST="${AGE_VPS_HOST:?the VPS host}"
AGE_VPS_USER="${AGE_VPS_USER:?the VPS user}"
AGE_VPS_PORT="${AGE_VPS_PORT:-22}"
AGE_PUBLIC_HOST="${AGE_PUBLIC_HOST:?the public hostname, e.g. age.digitaldadi.agency}"
AGE_ACME_EMAIL="${AGE_ACME_EMAIL:?an email address for the certificate authority}"
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

echo "==> 1/6 The console must already have a boundary. Checking it, on the box."

remote AGE_STUDIO_PORT="$AGE_STUDIO_PORT" <<'REMOTE'
set -euo pipefail

# ⚠️ THE CONSOLE IS A CONTAINER SINCE ADR-0076 D1, 🚫 NO LONGER A SYSTEMD UNIT.
# This asked `systemctl is-active age-studio`, which on the new deployment
# answers "inactive" for a console that is running perfectly — a refusal that
# would read exactly like a broken deployment.
if [ "$(docker inspect -f '{{.State.Running}}' age-studio 2>/dev/null || echo false)" != "true" ]; then
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

echo "==> 2/6 Installing the plaintext half only, so the certificate can be issued."

# 🛑 THE ORDER IS LOAD-BEARING. The real vhost names a certificate that does not
# exist yet, and `nginx -t` fails on a missing certificate file — so nginx would
# refuse to reload and the ACME challenge would never be reachable. The :80 half
# goes up alone first. ⚠️ It serves the challenge and redirects everything else,
# so at NO POINT is there a plaintext route to the console.
remote AGE_PUBLIC_HOST="$AGE_PUBLIC_HOST" <<'REMOTE'
set -euo pipefail

sudo -n mkdir -p /var/www/html
sudo -n tee "/etc/nginx/sites-available/${AGE_PUBLIC_HOST}" >/dev/null <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name ${AGE_PUBLIC_HOST};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
CONF

sudo -n ln -sf "/etc/nginx/sites-available/${AGE_PUBLIC_HOST}" \
               "/etc/nginx/sites-enabled/${AGE_PUBLIC_HOST}"
sudo -n nginx -t
sudo -n systemctl reload nginx
echo "    plaintext half enabled (challenge + redirect only)"
REMOTE

echo "==> 3/6 Obtaining the certificate (webroot; Cloudflare may stay orange)."

remote AGE_PUBLIC_HOST="$AGE_PUBLIC_HOST" AGE_ACME_EMAIL="$AGE_ACME_EMAIL" <<'REMOTE'
set -euo pipefail

if sudo -n test -f "/etc/letsencrypt/live/${AGE_PUBLIC_HOST}/fullchain.pem"; then
  echo "    a certificate already exists; not reissuing"
else
  sudo -n certbot certonly --webroot -w /var/www/html \
    -d "${AGE_PUBLIC_HOST}" \
    --non-interactive --agree-tos -m "${AGE_ACME_EMAIL}"
fi
REMOTE

echo "==> 4/6 Installing the real vhost (TLS, headers, proxy to loopback)."

# ⚠️ The file is piped, so what runs on the box is byte-for-byte the file in the
# repository. 🚫 There is no second copy of these rules to drift.
"${SSH[@]}" "sudo -n tee /etc/nginx/sites-available/${AGE_PUBLIC_HOST} >/dev/null" < "$VHOST_SOURCE"

remote AGE_PUBLIC_HOST="$AGE_PUBLIC_HOST" <<'REMOTE'
set -euo pipefail
sudo -n nginx -t
sudo -n systemctl reload nginx
echo "    vhost live"
REMOTE

echo "==> 5/6 Re-checking the things the exposure could have changed."

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
if sudo -n ss -ltn | grep -qE '^\S+\s+\S+\s+\S+\s+(0\.0\.0\.0|\*|\[::\]):5442'; then
  echo "REFUSED: AGE's database is listening on a public interface." >&2
  exit 1
fi

# 🛑 AND THE CONSOLE MUST STILL HAVE NO ROUTE TO A PEER'S STORE (ADR-0076 D7).
# ⚠️ THIS IS THE MOMENT IT MATTERS MOST: the console has just become reachable
# from the internet, so a defect in it is now reachable from the internet too.
# 🚫 A raw TCP connect, 🚫 not an application query that returned nothing.
docker exec age-studio node -e "
const net = require('node:net');
const peers = [['172.19.0.4',5432],['172.21.0.2',5432],['172.18.0.2',5432],['172.20.0.3',3306]];
let bad = 0;
Promise.all(peers.map(([host, port]) => new Promise((resolve) => {
  const s = net.connect({ host, port });
  const done = (reachable) => { s.destroy(); if (reachable) { bad += 1; console.error('    REACHABLE: ' + host + ':' + port); } resolve(); };
  s.setTimeout(2000);
  s.on('connect', () => done(true));
  s.on('timeout', () => done(false));
  s.on('error', () => done(false));
}))).then(() => {
  if (bad > 0) { console.error('REFUSED: the console can reach a peer database.'); process.exit(1); }
  console.log('    no peer database is reachable from the console');
});
"

echo "    console still loopback-only; database still private"
REMOTE

echo "==> 6/6 Done."
echo
echo "    https://${AGE_PUBLIC_HOST}"
echo
echo "    🛑 THE TUNNEL IS NO LONGER REQUIRED, AND THE BOUNDARY IS UNCHANGED BY"
echo "    THAT. What protects the console is the verified session inside it —"
echo "    the same rows, the same refusals, the same revocation on sign-out."
echo "    🚫 This script added no second authentication and must never grow one."
