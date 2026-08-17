#!/bin/sh
#
# ADR-0078 C1 — the capture CLI's entrypoint, inside AGE's own store namespace.
#
# 🛑 WHY THIS FILE EXISTS AT ALL, AND WHY THE SUBSTITUTION IS HERE AND NOWHERE
# ELSE.
#
# This container runs with `network_mode: container:age-postgres`, so it shares
# the STORE's network namespace. Inside it, `127.0.0.1:5432` IS AGE's database.
# That is the whole point of ADR-0078 option C: the capture chain keeps naming a
# LOOPBACK address, so `assertLocalDatabaseTarget` (ADR-0061 A5, ADR-0075 D4)
# passes UNMODIFIED. 🚫 No guard is relaxed to obtain the boundary.
#
# 🛑 **AND `127.0.0.1:5432` MUST NEVER BE WRITTEN INTO A HOST-SIDE FILE.** On this
# VPS the host's own `127.0.0.1:5432` is **SNARA's postgres** — which is exactly
# why `provision-studio-database.sh` REFUSES `AGE_DB_HOST_PORT=5432`. A
# provisioned env file carrying that string would be correct inside this
# namespace and would point AGE at a PEER's database anywhere else, and nothing
# would report the difference. 🚫 So the string is produced HERE, in the only
# namespace where it is true, and never persisted.
#
# ⚠️ **THE MOUNTED FILE IS THE *DERIVED* ONE, AND THAT IS DELIBERATE.**
# `/etc/age-studio/age-studio.env` is `root:root 0600` — a bind mount preserves
# host ownership, so a container running as the deploy uid could not read it.
# `/etc/age-studio/age-studio.container.env` is written by the ADR-0077 wrapper
# `age-deploy-derive-env`, which `chown`s it to the deploy account at mode 600.
# 🚫 No mode is widened anywhere to make this work, and 🚫 the source secret file
# is never mounted.
#
# ⚠️ It arrives as a read-only **mount**, 🚫 never as an `env_file:` — compose
# reads an `env_file` CLIENT-side and would then have to hand the value to the
# daemon, which is the shape #350 refused.
#
# 🚫 NO VALUE FROM THAT FILE IS EVER PRINTED, ECHOED OR LOGGED (ADR-0076 D6).

set -eu

PROVISIONED='/run/age/provisioned.env'
CONTAINER_HOST='127.0.0.1:5432'

if [ ! -r "$PROVISIONED" ]; then
  echo "REFUSED: the provisioned env file is not mounted at ${PROVISIONED}." >&2
  echo "  It is bind-mounted read-only by the daemon; run this through" >&2
  echo "  scripts/run-capture.sh rather than by hand." >&2
  exit 2
fi

# ⚠️ FAIL CLOSED, AND FAIL BEFORE THE CLI STARTS. An unresolvable target is a
# refusal, never a fallback — the run that needed the guard most is exactly the
# run that would have lost it.
provisioned_url=$(sed -n 's/^DATABASE_URL_APP=//p' "$PROVISIONED" | head -1)
if [ -z "$provisioned_url" ]; then
  echo "REFUSED: DATABASE_URL_APP is absent from the provisioned env file." >&2
  echo "  Run scripts/provision-studio-database.sh first; nothing is generated here." >&2
  exit 2
fi

# 🛑 WHATEVER AUTHORITY THE FILE NAMES IS REPLACED BY THE NAMESPACE ROUTE.
# ⚠️ The derived file names `172.23.0.2:5432` (the STUDIO's route over
# `age-internal`) and the provisioned one names `127.0.0.1:<published port>`;
# 🚫 the capture chain may use NEITHER — a bridge address is refused by
# `assertLocalDatabaseTarget` (ADR-0075 D4) and the host port is what C3 removes.
# ⚠️ The pattern excludes `@` and `/` from the host, so it can only ever match
# the authority section and can never run into a credential.
container_url=$(printf '%s' "$provisioned_url" | sed -E "s#@[^@/]+:[0-9]+/#@${CONTAINER_HOST}/#")

case "$container_url" in
  *"@${CONTAINER_HOST}/"*) ;;
  *)
    # 🚫 The URL is NOT printed. The refusal names the shape, never the value.
    echo "REFUSED: the provisioned DATABASE_URL_APP does not name a loopback host." >&2
    echo "  Expected an authority of the form @127.0.0.1:<port>/ ; fix it by hand." >&2
    exit 2
    ;;
esac

DATABASE_URL_APP="$container_url"
export DATABASE_URL_APP

# 🚫 THE OWNER CONNECTION IS NOT CONSTRUCTED HERE AND MUST NOT BE. The capture
# chain connects only as the non-owner application role (ADR-0046 D4); an owner
# URL in this environment would satisfy `DATABASE_URL` and silently disable
# every row-level policy. Migrations are a SEPARATE, owner-credentialled
# invocation — see scripts/run-migrations.sh.
unset DATABASE_URL || true

exec node /age/apps/capture/dist/bin/age-capture.cjs "$@"
