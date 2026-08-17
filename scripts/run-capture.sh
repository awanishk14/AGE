#!/usr/bin/env bash
#
# ADR-0078 C1 — run `age-capture` on the VPS through AGE's own store namespace.
#
# 🛑 **WHAT THIS REPLACES, AND WHY.** Until C1 the capture CLI ran as a HOST
# process against `127.0.0.1:${AGE_DB_HOST_PORT}` — AGE's published store port.
# That publication is the ONLY reason ADR-0076 D8 stayed open, and the CLI was
# its only remaining consumer. This script runs the same CLI, from the same
# image the console is built from, in a container that shares `age-postgres`'s
# network namespace — so `127.0.0.1:5432` IS AGE's store and the host port is
# not involved at any point.
#
# 🚫 **NO GUARD IS RELAXED TO GET THERE.** The URL the capture chain sees still
# names a LOOPBACK address, so `assertLocalDatabaseTarget` (ADR-0061 A5,
# ADR-0075 D4) passes UNMODIFIED. That is the whole argument for option C over
# option A, and 🚫 it must not be traded away later for convenience.
#
# ⚠️ **CAPTURE IS AN OWNER ACT ON THIS HOST, 🚫 NOT A DEPLOY ACT.** Running a
# container requires the Docker socket, and ADR-0077 deliberately gives
# `age-deploy` **four fixed-argument wrappers and nothing else** — a capture run
# takes operator-chosen arguments, so it cannot be one of them without becoming
# the arbitrary-argument grant the ADR refused. 🚫 **DO NOT ADD A FIFTH WRAPPER
# TO MAKE THIS RUN AS `age-deploy`**: that would change the deploy-identity
# architecture, which C1 is explicitly not permitted to touch. This script is
# invoked with the OWNER account, exactly like `provision-studio-database.sh`.
#
# ⚠️ **AND `dist` MUST EXIST IN THE IMAGE.** `apps/capture/dist` is not tracked;
# `apps/studio/Dockerfile` builds it. If this refuses with a missing bin, the
# image predates C1 — 🚫 rebuild it, do not reach for a host-side `pnpm`.
#
# Usage:
#   AGE_VPS_HOST=… AGE_VPS_USER=… AGE_VPS_PORT=… AGE_VPS_PATH=… \
#   AGE_VPS_DISCOVERY_WORKSPACE=… AGE_VPS_CLIENT_RECORD_FILE=… \
#     bash scripts/run-capture.sh <age-capture arguments…>

set -euo pipefail

require() {
  # 🚫 NOTHING IS DEFAULTED. A defaulted host, path or record file is a run
  # against something nobody named (ADR-0054 D2/D3).
  if [ -z "${!1:-}" ]; then
    echo "REFUSED: ${1} must be set; nothing here is defaulted." >&2
    exit 1
  fi
}

require AGE_VPS_HOST
require AGE_VPS_USER
require AGE_VPS_PORT
require AGE_VPS_PATH
require AGE_VPS_DISCOVERY_WORKSPACE
require AGE_VPS_CLIENT_RECORD_FILE

if [ "$#" -eq 0 ]; then
  echo "REFUSED: no capture arguments were given." >&2
  echo "  usage: bash scripts/run-capture.sh <age-capture arguments…>" >&2
  exit 1
fi

SSH=(ssh -p "$AGE_VPS_PORT" "${AGE_VPS_USER}@${AGE_VPS_HOST}")

# ⚠️ THE SAME RULE AS `provision-studio-database.sh`: the program goes down the
# pipe, so no value this script holds ever becomes a remote `argv` that another
# account on this shared host could read out of `ps` (#350). ⚠️ `%q` is bash's
# own quoting, so an argument containing a space or a quote arrives as itself.
{
  printf 'export %s=%q\n' AGE_VPS_PATH "$AGE_VPS_PATH"
  printf 'export %s=%q\n' AGE_VPS_DISCOVERY_WORKSPACE "$AGE_VPS_DISCOVERY_WORKSPACE"
  printf 'export %s=%q\n' AGE_VPS_CLIENT_RECORD_FILE "$AGE_VPS_CLIENT_RECORD_FILE"
  printf 'set -- '
  printf '%q ' "$@"
  printf '\n'
  cat <<'REMOTE'
set -euo pipefail

# 🛑 🚫 **NOTHING HERE MAY `cd` INTO THE DEPLOY PATH OR READ THE OPERATOR FILES
# DIRECTLY.** Since ADR-0077 the checkout is `/home/age-deploy/age` and
# `/var/lib/age-operator` is mode 700, both owned by `age-deploy` — and this
# script runs as the OWNER account, which is deliberately NOT that account.
# The owner reaches them only through `sudo`, and the compose file is therefore
# named by ABSOLUTE PATH with `--project-directory` supplying the base compose
# would otherwise take from the working directory.
# ⚠️ 🛑 **THE SEPARATION IS THE POINT, 🚫 NOT AN OBSTACLE.** The repair is never
# to widen a mode or to move the files back under the owner; it is to reach them
# as root for exactly the two facts needed, which is what happens below.
CAPTURE_COMPOSE="${AGE_VPS_PATH}/deploy/vps/compose/docker-compose.age-capture.yml"
if ! sudo test -r "$CAPTURE_COMPOSE"; then
  echo "REFUSED: the capture compose file is not present at ${CAPTURE_COMPOSE}." >&2
  echo "  The deployment predates ADR-0078 C1; deploy first, then capture." >&2
  exit 2
fi

# 🛑 THE UID IS DERIVED FROM THE RECORD FILE, 🚫 NOT CHOSEN. Identical rule and
# identical reason to the ADR-0077 compose wrapper: the container reads the
# operator's 0600 files, so it must run as the account that owns them, and the
# repair for a permission fault is 🚫 never `chmod o+r` on a real client's record.
if ! uid="$(sudo stat -c %u "$AGE_VPS_CLIENT_RECORD_FILE" 2>/dev/null)"; then
  echo "REFUSED: cannot stat the operator record; nothing is guessed here." >&2
  exit 2
fi
gid="$(sudo stat -c %g "$AGE_VPS_CLIENT_RECORD_FILE")"

if [ "$uid" = '0' ]; then
  echo "REFUSED: the operator record is owned by root; capture must not run as root." >&2
  exit 2
fi

# ⚠️ THE STORE MUST ALREADY BE UP. `network_mode: container:age-postgres` fails
# with an obscure message if it is not, so the refusal is stated here instead.
if ! sudo docker inspect -f '{{.State.Running}}' age-postgres 2>/dev/null | grep -qx true; then
  echo "REFUSED: age-postgres is not running, so there is no namespace to join." >&2
  exit 2
fi

# 🚫 NO CREDENTIAL IS PASSED HERE, ON PURPOSE. The container mounts the derived
# env file read-only and computes its own container-route URL inside the
# namespace — see `apps/capture/docker-entrypoint.sh` for why that string must
# never exist in a host-side file on this box.
AGE_VPS_DISCOVERY_WORKSPACE="$AGE_VPS_DISCOVERY_WORKSPACE" \
AGE_VPS_CLIENT_RECORD_FILE="$AGE_VPS_CLIENT_RECORD_FILE" \
AGE_STUDIO_UID="$uid" \
AGE_STUDIO_GID="$gid" \
  sudo --preserve-env=AGE_VPS_DISCOVERY_WORKSPACE,AGE_VPS_CLIENT_RECORD_FILE,AGE_STUDIO_UID,AGE_STUDIO_GID \
  docker compose -f "$CAPTURE_COMPOSE" --project-directory "$AGE_VPS_PATH" \
  run --rm capture "$@"
REMOTE
} | "${SSH[@]}" bash -s
