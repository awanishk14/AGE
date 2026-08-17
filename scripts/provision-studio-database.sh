#!/usr/bin/env bash
#
# Give the deployed AGE Studio its own durable Postgres store — ADR-0061 A5,
# ADR-0074 D8, ADR-0075 D1–D5.
#
# ─────────────────────────────────────────────────────────────────────────────
# 🛑 WHAT THIS SCRIPT USED TO DO, AND WHY IT WAS WRONG.
#
# It ran `sudo -u postgres psql` and wrote `127.0.0.1:5432` into the console's
# connection string. Measured against the real VPS, BOTH were false:
#
#   · There is NO PostgreSQL on that host and NO `postgres` user. Every Postgres
#     on the box is a container.
#   · `127.0.0.1:5432` is SNARA'S published port. 🛑 THE SCRIPT WOULD HAVE
#     POINTED AGE AT ANOTHER PRODUCT'S DATABASE — silently, and with every test
#     in the repository still green.
#
# ⚠️ It had never been run, so nothing happened. It is CORRECTED here rather
# than worked around, and the two mistakes are now REFUSALS BY NAME (see the
# checks below) so neither can come back as a default.
#
# ─────────────────────────────────────────────────────────────────────────────
# 🛑 WHAT THIS SCRIPT DELIBERATELY DOES NOT DO.
#
# It does NOT expose the console, open a port, install a reverse proxy or write
# a vhost. ADR-0074 D9 puts TLS and the public bind LAST, together with the
# authenticated boundary, and the owner said it again when they accepted
# ADR-0075: "Do not expose age.digitaldadi.agency yet. Public exposure remains
# the final step after authentication and isolation are proven." A database is a
# store, not a door.
#
# It does NOT create an operator account, a session row or a credential. AGE
# mints nothing (ADR-0068 §0.1c, ADR-0074 D4). Provisioning is an ACT performed
# by a human with an owner connection, and it stays one.
#
# It does NOT touch RankOps, SNARA, Drishti or any other product. 🚫 It does not
# read their credentials, attach to their networks, or create a role in their
# instances. ADR-0075 D6: AGE MUST NEVER SHARE A DATABASE WITH A PEER PRODUCT.
#
# ⚠️ THE SEPARATION THAT MATTERS. Two roles, two connection strings, two jobs:
#
#   AGE_DB_OWNER_URL  the OWNER. Runs migrations. Held by the human, for the
#                     length of one command, and 🚫 never written into the
#                     service's environment.
#   DATABASE_URL_APP  the non-owner `age_app` role. NOSUPERUSER, NOCREATEDB,
#                     NOCREATEROLE, NOBYPASSRLS. What the console runs as, all
#                     day. It is granted exactly what the migrations grant it.
#
# An application process holding owner credentials is an application process
# that can drop a table by accident, and one that is exempt from every row-level
# policy while it does so.
#
# ⚠️ NOTHING IS DEFAULTED and 🚫 no password is generated here. A generated
# secret is a secret nobody can rotate, because nobody knows it. The operator
# supplies every value; this script never echoes a credential.

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

# ⚠️ The database name, the SUPERUSER of AGE's OWN instance, and the application
# role's password. Supplied, never invented.
#
# 🛑 **AND EVERY ONE OF THEM TRAVELS ON STDIN** — see `remote()` below. An
# earlier version of this comment claimed they were "passed through an
# environment variable, so none appears in a remote argv", and that claim was
# FALSE: `ssh host "VAR='secret' bash -s"` puts the whole string into the remote
# shell's own argv, where `ps`/`/proc` shows it to every other user on that box
# for as long as the step runs. ⚠️ A false assurance in a comment is worse than
# no comment, because the next reader stops looking.
require AGE_DB_NAME
require AGE_DB_SUPERUSER
require AGE_DB_SUPERUSER_PASSWORD
require AGE_DB_APP_PASSWORD

# 🛑 THE HOST PORT AGE'S OWN STORE PUBLISHES ON LOOPBACK. Required, with NO
# DEFAULT — see the refusal below for why this one is not a matter of taste.
require AGE_DB_HOST_PORT

# The owner connection, used ONLY by this script and ONLY for the length of the
# migration. 🚫 It is never written to the unit file.
require AGE_DB_OWNER_URL

# 🛑 THE ORGANIZATION THIS DEPLOYMENT SERVES (ADR-0074 §7 slice 2). It is 🚫 NOT
# a secret and 🚫 NOT an authorization: it is the RLS *lookup* scope the console
# needs before it can read a session row at all, and every entitlement decision
# is taken from the ROW that comes back, never from this value. It can only
# NARROW what is visible.
#
# ⚠️ IT IS REQUIRED, WITH NO DEFAULT. A console that guessed its organization
# would either see nothing and blame the operator's credential, or — worse —
# read rows it was never meant to. The boundary refuses by NAME when it is
# absent (`deployment-not-configured`), and 🚫 never says "that token was not
# accepted" about a good token.
require AGE_STUDIO_ORGANIZATION_ID

# ─────────────────────────────────────────────────────────────────────────────
# 🛑 THE TWO REFUSALS THAT EXIST BECAUSE THIS SCRIPT ONCE GOT THEM WRONG.

# 🛑 5432 IS SOMEBODY ELSE'S. On the VPS this script targets, `127.0.0.1:5432`
# is already published by another product's Postgres. AGE publishing there would
# either fail to start or — depending on which came up first — leave AGE's
# connection string pointing into a database that is not AGE's.
#
# ⚠️ The refusal is on the number, not on the current occupant, and that is
# deliberate: it must keep refusing after the neighbour moves, because the reason
# is "this port is the one everybody assumes", not "SNARA is there today".
if [ "$AGE_DB_HOST_PORT" = "5432" ]; then
  echo "REFUSED: AGE_DB_HOST_PORT is 5432." >&2
  echo "  That is the port every Postgres on a shared host is assumed to be on," >&2
  echo "  and on this VPS another product already publishes it. Pick a port that" >&2
  echo "  belongs to AGE (ADR-0075 D1/D4)." >&2
  exit 2
fi

# 🛑 THE OWNER URL MUST ADDRESS AGE'S OWN STORE, NOT A NEIGHBOUR'S. A migration
# applied to the wrong instance is not a mistake that reports itself: it creates
# AGE's tables inside somebody else's database and then works.
case "$AGE_DB_OWNER_URL" in
  *:5432/*)
    echo "REFUSED: AGE_DB_OWNER_URL addresses port 5432." >&2
    echo "  AGE's own store is published on AGE_DB_HOST_PORT (${AGE_DB_HOST_PORT})." >&2
    echo "  🚫 Migrations are never applied to a peer product's database (ADR-0075 D6)." >&2
    exit 2
    ;;
esac

case "$AGE_DB_OWNER_URL" in
  *"127.0.0.1:${AGE_DB_HOST_PORT}"* | *"localhost:${AGE_DB_HOST_PORT}"*) ;;
  *)
    echo "REFUSED: AGE_DB_OWNER_URL does not address AGE's own store." >&2
    echo "  Expected loopback on port ${AGE_DB_HOST_PORT}." >&2
    echo "  🚫 The host is not echoed here — a connection string carries a password." >&2
    exit 2
    ;;
esac

SSH=(ssh -p "$AGE_VPS_PORT" "${AGE_VPS_USER}@${AGE_VPS_HOST}")

# ─────────────────────────────────────────────────────────────────────────────
# 🛑 THE ONE WAY THIS SCRIPT TALKS TO THE SERVER, AND 🚫 THERE MUST NOT BE A
# SECOND.
#
# ⚠️ **A REMOTE COMMAND LINE IS PUBLIC ON THAT HOST.** `ssh host "VAR=secret
# bash -s"` hands the string to the remote login shell as its argv, and every
# other user on the box can read it out of `ps` or `/proc/<pid>/cmdline` while
# the step runs. Nothing is logged, nothing is exploited, nothing looks wrong —
# which is exactly why it survived review.
#
# 🛑 **SO THE ASSIGNMENTS GO DOWN THE PIPE, AHEAD OF THE SCRIPT.** `bash -s`
# reads its whole program from stdin, so `export` lines prepended to the
# heredoc ARE part of that program: the values never exist as arguments to
# anything. ⚠️ `%q` is bash's own quoting, so a password containing a quote, a
# space or a `$` arrives as itself rather than as shell syntax.
#
# ⚠️ Usage: `remote NAME=value ... <<'REMOTE' … REMOTE`. 🚫 Do not add a variant
# that takes a command string — the point of this helper is that there is
# nowhere left to put a secret except stdin.
remote() {
  {
    local assignment
    for assignment in "$@"; do
      printf 'export %s=%q\n' "${assignment%%=*}" "${assignment#*=}"
    done
    # ⚠️ Then the caller's heredoc, unchanged, as the rest of the program.
    cat
  } | "${SSH[@]}" bash -s
}
# 🚫 NO `SERVICE`. ADR-0077 D5 removed the disabled `age-studio.service`.
ENV_FILE="/etc/age-studio/age-studio.env"
CONTAINER="age-postgres"
COMPOSE_FILE="${AGE_VPS_PATH}/deploy/vps/docker-compose.age-postgres.yml"
COMPOSE_ENV="/etc/age-studio/age-postgres.env"

echo "==> Writing the store's own env file and bringing up ${CONTAINER}"
# ⚠️ THE COMPOSE FILE IS THE ONE IN THE CHECKOUT — the reviewed one. 🚫 No YAML
# is generated here: a compose file written by a script is a compose file nobody
# read, and its `ports:` line is the one thing that must be readable.
#
# 🛑 THE ENV FILE HOLDS THE SUPERUSER PASSWORD. Root-owned, mode 600, on the
# server, 🚫 never committed, 🚫 never rsynced, 🚫 never echoed.
remote   AGE_DB_NAME="$AGE_DB_NAME"   AGE_DB_SUPERUSER="$AGE_DB_SUPERUSER"   AGE_DB_SUPERUSER_PASSWORD="$AGE_DB_SUPERUSER_PASSWORD"   AGE_DB_HOST_PORT="$AGE_DB_HOST_PORT"   COMPOSE_FILE="$COMPOSE_FILE"   COMPOSE_ENV="$COMPOSE_ENV" <<'REMOTE'
set -euo pipefail

sudo install -d -m 700 -o root -g root /etc/age-studio

umask 077
{
  printf 'AGE_DB_NAME=%s\n' "$AGE_DB_NAME"
  printf 'AGE_DB_SUPERUSER=%s\n' "$AGE_DB_SUPERUSER"
  printf 'AGE_DB_SUPERUSER_PASSWORD=%s\n' "$AGE_DB_SUPERUSER_PASSWORD"
  printf 'AGE_DB_HOST_PORT=%s\n' "$AGE_DB_HOST_PORT"
} | sudo tee "$COMPOSE_ENV" >/dev/null
sudo chown root:root "$COMPOSE_ENV"
sudo chmod 600 "$COMPOSE_ENV"

sudo docker compose -f "$COMPOSE_FILE" --env-file "$COMPOSE_ENV" up -d

# ⚠️ WAIT FOR IT TO BE READY, and 🚫 do not assume. `up -d` returns when the
# container is started, not when Postgres is accepting connections; the next
# step would then fail for a reason that has nothing to do with its own work.
for _ in $(seq 1 30); do
  if sudo docker exec age-postgres pg_isready -U "$AGE_DB_SUPERUSER" -d "$AGE_DB_NAME" >/dev/null 2>&1; then
    ready=yes
    break
  fi
  sleep 2
done
if [ "${ready:-no}" != "yes" ]; then
  echo "REFUSED: age-postgres did not become ready." >&2
  exit 1
fi
REMOTE

echo "==> Confirming this is AGE's OWN container, on AGE's OWN volume"
# 🛑 ADR-0075 D1/D3/D6, CHECKED RATHER THAN ASSUMED. If a container called
# `age-postgres` were ever pointed at a peer's volume or attached to a peer's
# network, every later step here would still succeed — and AGE's rows would be
# living in somebody else's store. So it is measured, once, before the migration.
remote CONTAINER="$CONTAINER" <<'REMOTE'
set -euo pipefail

mounts=$(sudo docker inspect "$CONTAINER" --format '{{range .Mounts}}{{.Name}} {{end}}')
networks=$(sudo docker inspect "$CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}')

echo "    volume(s):  $mounts"
echo "    network(s): $networks"

case "$mounts" in
  *age_postgres_data*) ;;
  *)
    echo "REFUSED: ${CONTAINER} is not on AGE's own volume." >&2
    exit 1
    ;;
esac

# 🚫 NO PEER NETWORK, EVER. Named individually so the refusal says which.
for peer in rankops snara drishti; do
  case "$networks" in
    *"$peer"*)
      echo "REFUSED: ${CONTAINER} is attached to a ${peer} network (ADR-0075 D3/D6)." >&2
      exit 1
      ;;
  esac
done

# 🚫 AND NOT PUBLIC. The published binding must be loopback.
binding=$(sudo docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}')
case "$binding" in
  *'"HostIp":"0.0.0.0"'* | *'"HostIp":"::"'*)
    echo "REFUSED: ${CONTAINER} publishes a port off loopback." >&2
    exit 1
    ;;
esac
echo "    published:  $binding"
REMOTE

echo "==> Creating the non-owner application role"
# ⚠️ IDEMPOTENT BY CONSTRUCTION. Re-running must not fail and must not reset a
# password that is already in the unit file — so the role is created only when
# absent, and the password is set explicitly either way (the operator supplied
# it, so the two are the same value).
#
# ⚠️ The role's attributes are the ci-db.yml ones, verbatim — 🚫 no drift between
# what CI proves and what production runs. NOBYPASSRLS is the one that keeps the
# row-level policies applying to this connection at all.
#
# ⚠️ `psql` RUNS INSIDE AGE'S OWN CONTAINER. 🚫 There is no `sudo -u postgres` on
# this host and there never was; a host `psql` would have to be told which of the
# box's several instances to dial, and the wrong answer is silent.
remote   CONTAINER="$CONTAINER"   AGE_DB_NAME="$AGE_DB_NAME"   AGE_DB_SUPERUSER="$AGE_DB_SUPERUSER"   PGPASSWORD="$AGE_DB_SUPERUSER_PASSWORD"   AGE_DB_APP_PASSWORD="$AGE_DB_APP_PASSWORD" <<'REMOTE'
set -euo pipefail

sudo docker exec -i \
  -e PGPASSWORD="$PGPASSWORD" \
  -e AGE_DB_APP_PASSWORD="$AGE_DB_APP_PASSWORD" \
  "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$AGE_DB_SUPERUSER" -d "$AGE_DB_NAME" \
  -v apppass="$AGE_DB_APP_PASSWORD" <<SQL
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

GRANT CONNECT ON DATABASE $(printf '%s' "$AGE_DB_NAME") TO age_app;
GRANT USAGE ON SCHEMA public TO age_app;
SQL
REMOTE

echo "==> Applying the COMMITTED migrations as the OWNER"
# ⚠️ `prisma migrate deploy` — 🚫 never `migrate dev`, which would author new SQL
# on a real store. This applies the reviewed files and nothing else, which is
# what makes "the SQL that was reviewed is the SQL that ran" true (ADR-0032 D8).
#
# 🛑 THE OWNER URL IS A CREDENTIAL, and it now travels on stdin like the rest.
# ⚠️ It previously rode the remote command line under a comment asserting the
# opposite — the most valuable single line this change removes, because it is
# the highest-privilege credential in the script.
#
# 🛑 **ADR-0078 C1 — THIS STEP NO LONGER TOUCHES THE HOST PUBLICATION.** It used
# to run on the host against `127.0.0.1:${AGE_DB_HOST_PORT}`, which made the
# publication load-bearing for PROVISIONING as well as for capture — so C3 could
# not have removed the publication while this line stood. It now runs in a
# container sharing `age-postgres`'s network namespace, where `127.0.0.1:5432`
# IS AGE's store. 🚫 No guard is relaxed to get there: the URL still names a
# loopback address, exactly as `assertLocalDatabaseTarget` requires.
#
# ⚠️ THE REWRITE IS ANCHORED ON THE AUTHORITY (`@host:port/`) and excludes `@`
# and `/` from the host, so it can never run into the credential.
AGE_DB_OWNER_URL_CONTAINER=$(
  printf '%s' "$AGE_DB_OWNER_URL" | sed -E 's#@[^@/]+:[0-9]+/#@127.0.0.1:5432/#'
)
# ⚠️ FAIL CLOSED. An unrewritten URL would silently migrate through the host port
# again and the step would still report success.
case "$AGE_DB_OWNER_URL_CONTAINER" in
  *'@127.0.0.1:5432/'*) ;;
  *)
    # 🚫 The URL is not printed. The refusal names the shape, never the value.
    echo "REFUSED: AGE_DB_OWNER_URL could not be rewritten to the container route." >&2
    exit 1
    ;;
esac

remote   AGE_VPS_PATH="$AGE_VPS_PATH"   AGE_DB_OWNER_URL_CONTAINER="$AGE_DB_OWNER_URL_CONTAINER" <<'REMOTE'
set -euo pipefail

cd "$AGE_VPS_PATH"
# 🚫 THE CREDENTIAL IS NOT AN ARGUMENT. It is already exported here (the `remote`
# helper put it on stdin), and the compose file interpolates it from this
# environment into the service's `environment:` — so it never enters any argv.
export AGE_DB_OWNER_URL_CONTAINER
# ⚠️ `--preserve-env=<NAME>` AND NOTHING WIDER. Plain `sudo` clears the
# environment, so the compose interpolation would see an empty value and the
# `:?` in the compose file would REFUSE — a correct failure, but the wrong one.
# 🚫 Do not reach for `sudo -E`: that forwards the whole environment, including
# every other credential this script is holding.
sudo --preserve-env=AGE_DB_OWNER_URL_CONTAINER \
  docker compose -f deploy/vps/compose/docker-compose.age-capture.yml \
  run --rm migrate
REMOTE

echo "==> Writing the service's EnvironmentFile (mode 600, root-owned)"
# 🛑 THIS FILE HOLDS A CREDENTIAL. It is written on the server, readable by root
# only, and 🚫 it is never committed, never rsynced and never echoed. The deploy
# script excludes every `.env*` by construction.
#
# ⚠️ 127.0.0.1 AND AGE'S OWN PORT. `selectDeployedDatabaseComposition` refuses a
# publicly reachable host ABOVE `new PrismaClient(`, so a store that was
# accidentally exposed stops the console rather than being used by it — but that
# check cannot tell AGE's loopback database from a neighbour's, which is why the
# port is required and 5432 is refused above.
# ⚠️ `AGE_STUDIO_ORGANIZATION_ID` is an identifier, 🚫 not a credential — but it
# goes down the same pipe as everything else, because a second way of reaching
# the server is a second place a secret can be put by mistake.
remote   AGE_DB_NAME="$AGE_DB_NAME"   AGE_DB_APP_PASSWORD="$AGE_DB_APP_PASSWORD"   AGE_DB_HOST_PORT="$AGE_DB_HOST_PORT"   AGE_STUDIO_ORGANIZATION_ID="$AGE_STUDIO_ORGANIZATION_ID" <<'REMOTE'
set -euo pipefail

sudo install -d -m 700 -o root -g root /etc/age-studio

umask 077
# 🛑 BOTH LINES, ONE FILE, ONE WRITE. The console refuses to start without the
# connection and refuses to admit anybody without the organization — 🚫 neither
# is defaulted, and a file carrying only one of them is a misconfiguration the
# operator finds at the door instead of silently.
{
  printf 'DATABASE_URL_APP=postgresql://age_app:%s@127.0.0.1:%s/%s?schema=public\n' \
    "$AGE_DB_APP_PASSWORD" "$AGE_DB_HOST_PORT" "$AGE_DB_NAME"
  printf 'AGE_STUDIO_ORGANIZATION_ID=%s\n' "$AGE_STUDIO_ORGANIZATION_ID"
} |
  sudo tee /etc/age-studio/age-studio.env >/dev/null

sudo chown root:root /etc/age-studio/age-studio.env
sudo chmod 600 /etc/age-studio/age-studio.env
REMOTE

cat <<NEXT

==> Done. The store exists; 🚫 nothing was exposed.

    The console reads ${ENV_FILE}. Redeploy to pick it up:

      bash scripts/deploy-studio.sh

    🚫 NOT `systemctl restart age-studio`. The console has been a CONTAINER
    since ADR-0076 D1, and ADR-0077 D5 removed the disabled host unit that this
    line still pointed at — a re-armable path back to a host process.

    ⚠️ An ABSENT DATABASE_URL_APP is a REFUSAL, never a default: the console
    stops rather than starting against a database nobody chose.

    🛑 STILL NOT PUBLIC. ADR-0074 D9 keeps the public bind and the TLS vhost for
    the slice that lands them, and the Product Owner repeated the fence when
    they accepted ADR-0075: age.digitaldadi.agency is not exposed until
    authentication and isolation are proven. The SSH tunnel remains the only way
    in until then.
NEXT
