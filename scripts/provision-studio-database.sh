#!/usr/bin/env bash
#
# Give the deployed AGE Studio its own durable Postgres store — ADR-0061 A5,
# ADR-0074 D8, §7 slice 1.
#
# ─────────────────────────────────────────────────────────────────────────────
# 🛑 WHAT THIS SCRIPT DELIBERATELY DOES NOT DO.
#
# It does NOT expose the console, open a port, install a reverse proxy or write
# a vhost. ADR-0074 D9 puts TLS and the public bind LAST, together with the
# authenticated boundary, and the owner's acceptance says it in their own words:
# "No public deployment before the authenticated boundary is verified. Do not
# expose the Studio unauthenticated even temporarily." A database is a store,
# not a door.
#
# It does NOT create an operator account, a session row or a credential. AGE
# mints nothing (ADR-0068 §0.1c, ADR-0074 D4). Provisioning is an ACT performed
# by a human with an owner connection, and it stays one.
#
# ⚠️ THE SEPARATION THAT MATTERS. Two roles, two connection strings, two jobs:
#
#   DATABASE_URL      the OWNER. Runs migrations. Held by the human, for the
#                     length of one command, and 🚫 never written into the
#                     service's environment.
#   DATABASE_URL_APP  the non-owner `age_app` role. NOSUPERUSER, NOCREATEDB,
#                     NOCREATEROLE, NOBYPASSRLS. What the console runs as, all
#                     day. It is granted exactly what the migrations grant it —
#                     SELECT on the session store, and nothing more.
#
# An application process holding owner credentials is an application process
# that can drop a table by accident, and one that is exempt from every row-level
# policy while it does so.
#
# ⚠️ NOTHING IS DEFAULTED and 🚫 no password is generated here. A generated
# secret is a secret nobody can rotate, because nobody knows it. The operator
# supplies both connection strings; this script never echoes either.

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

# ⚠️ The database name and the application role's PASSWORD. Supplied, never
# invented. 🚫 The password is passed to the remote psql through an environment
# variable on the remote side, so it never appears in a remote argv that
# `ps`/`/proc` would show to every other user on that host.
require AGE_DB_NAME
require AGE_DB_APP_PASSWORD

# The owner connection, used ONLY by this script and ONLY for the length of the
# migration. 🚫 It is never written to the unit file.
require AGE_DB_OWNER_URL

SSH=(ssh -p "$AGE_VPS_PORT" "${AGE_VPS_USER}@${AGE_VPS_HOST}")
SERVICE="age-studio"
ENV_FILE="/etc/age-studio/age-studio.env"

echo "==> Creating the database and the non-owner application role"
# ⚠️ IDEMPOTENT BY CONSTRUCTION. Re-running must not fail and must not reset a
# password that is already in the unit file — so the role is created only when
# absent, and the password is set explicitly either way (the operator supplied
# it, so the two are the same value).
#
# ⚠️ The role's attributes are the ci-db.yml ones, verbatim. NOBYPASSRLS is the
# one that keeps the row-level policies applying to this connection at all.
"${SSH[@]}" "AGE_DB_NAME='${AGE_DB_NAME}' AGE_DB_APP_PASSWORD='${AGE_DB_APP_PASSWORD}' bash -s" <<'REMOTE'
set -euo pipefail

sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -v dbname="$AGE_DB_NAME" \
  -v apppass="$AGE_DB_APP_PASSWORD" <<SQL
SELECT 'CREATE DATABASE ' || quote_ident(:'dbname')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname')
\gexec

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'age_app') THEN
    CREATE ROLE age_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
\$\$;

ALTER ROLE age_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
  PASSWORD :'apppass';

-- 🚫 age_app may not create objects. It reads what the migrations granted it.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$AGE_DB_NAME" <<SQL
GRANT CONNECT ON DATABASE $(printf '%s' "$AGE_DB_NAME") TO age_app;
GRANT USAGE ON SCHEMA public TO age_app;
SQL
REMOTE

echo "==> Applying the COMMITTED migrations as the OWNER"
# ⚠️ `prisma migrate deploy` — 🚫 never `migrate dev`, which would author new SQL
# on a real store. This applies the reviewed files and nothing else, which is
# what makes "the SQL that was reviewed is the SQL that ran" true (ADR-0032 D8).
#
# ⚠️ The owner URL is passed through the remote environment, so it is not in an
# argv any other user on that host can read.
"${SSH[@]}" "cd '${AGE_VPS_PATH}' && DATABASE_URL='${AGE_DB_OWNER_URL}' pnpm --filter @age/persistence prisma:migrate:deploy"

echo "==> Writing the service's EnvironmentFile (mode 600, root-owned)"
# 🛑 THIS FILE HOLDS A CREDENTIAL. It is written on the server, readable by root
# only, and 🚫 it is never committed, never rsynced and never echoed. The deploy
# script excludes every `.env*` by construction.
#
# ⚠️ 127.0.0.1, and that is the whole point. `selectDeployedDatabaseComposition`
# refuses a publicly reachable host ABOVE `new PrismaClient(`, so a store that
# was accidentally exposed stops the console rather than being used by it.
"${SSH[@]}" "AGE_DB_NAME='${AGE_DB_NAME}' AGE_DB_APP_PASSWORD='${AGE_DB_APP_PASSWORD}' bash -s" <<'REMOTE'
set -euo pipefail

sudo install -d -m 700 -o root -g root /etc/age-studio

umask 077
printf 'DATABASE_URL_APP=postgresql://age_app:%s@127.0.0.1:5432/%s?schema=public\n' \
  "$AGE_DB_APP_PASSWORD" "$AGE_DB_NAME" |
  sudo tee /etc/age-studio/age-studio.env >/dev/null

sudo chown root:root /etc/age-studio/age-studio.env
sudo chmod 600 /etc/age-studio/age-studio.env
REMOTE

echo "==> Confirming Postgres is NOT listening off loopback"
# 🛑 THE CHECK THAT MATTERS HERE, and it is separate from the console's. A store
# reachable from the internet is a client's data reachable from the internet,
# whatever the console does. ⚠️ The application's own judgement refuses such a
# target too — this is the second of the two, not a substitute for it.
"${SSH[@]}" "ss -ltn 2>/dev/null | grep ':5432' || echo '    (nothing listening on 5432 — check the server)'"

cat <<NEXT

==> Done. The store exists; 🚫 nothing was exposed.

    The unit reads ${ENV_FILE}. Restart the service to pick it up:

      sudo systemctl restart ${SERVICE}

    ⚠️ An ABSENT DATABASE_URL_APP is a REFUSAL, never a default: the console
    stops rather than starting against a database nobody chose.

    🛑 STILL NOT PUBLIC. ADR-0074 D9 keeps the public bind and the TLS vhost
    for the slice that lands the authenticated boundary. The SSH tunnel remains
    the only way in until then.
NEXT
