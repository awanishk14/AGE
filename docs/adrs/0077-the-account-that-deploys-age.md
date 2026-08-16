# ADR-0077 — The account that deploys AGE: a dedicated identity, and the root it does not get

Status: **Accepted** (2026-08-17) — ⚠️ **BY THE PRODUCT OWNER, 🚫 NOT self-accepted.**
This ADR changes who holds root on a shared host carrying four other products, so it was a decision
request for the **Product Owner** and was answered by them. ⚠️ The §2 mandate covers architecture
inside AGE; it does not cover redrawing the privilege boundary of a box AGE shares with peers it does
not own — see §0.1b for the acceptance, verbatim.

Depends on: ADR-0076 **D1–D8** (the console on a shared host) · ADR-0075 **D1–D6** (AGE's own
database and the boundary between peers) · ADR-0074 **D8/D9** · ADR-0054 **D2/D3** (an operator
file's path is never defaulted, and lives outside the checkout) · ADR-0053 **D3** (real client
records are never widened).
Amends: **ADR-0076 §0.2 item 6** — see §0.2b, which corrects it. Supersedes: nothing.

---

## 0.1b The acceptance, verbatim (Product Owner, 2026-08-17)

> _"Accept ADR-0077 as Product Owner._
>
> _Status may now be flipped from Proposed to Accepted with my acceptance recorded verbatim._
>
> _Then proceed with Slice 2 only:_
>
> _Create age-deploy on the real VPS._
> _Install the four root-owned 0755 root:root wrappers exactly as ADR-0077 specifies._
> _Install the narrowly scoped sudoers rules._
> _Migrate AGE deployment path to /home/age-deploy/age._
> _Migrate /var/lib/age-operator ownership to age-deploy without changing its contents or permissions
> beyond what is required._
> _Ensure AGE Studio continues running unprivileged with the correct UID._
> _Re-deploy AGE using AGE_VPS_USER=age-deploy._
> _Do not modify RankOps, SNARA, Drishti, Scanner or their databases/secrets._
> _Do not resolve ADR-0076 D8 in this slice._
> _Do not take down or change the public URL https://age.digitaldadi.agency._
>
> _Security acceptance on the real VPS is mandatory._ […] _Also test the negative cases, not merely
> successful deployment._ _Run the real browser acceptance after deployment._
>
> _Do not start ADR-0076 D8, RankOps ecosystem work, or another product slice afterward. Stop and
> report the measured result first._
>
> _Report only what was actually proven on the VPS. Do not treat successful CI as proof of
> host-level security."_

⚠️ **The acceptance is of the ADR as written — 🚫 it did not widen it.** §2.1, §2.2 and §5 stand
unchanged: `drishti` keeps its root-equivalent access to the peers, ADR-0076 D8 stays open, and the
public URL stays public. The owner named the last two by hand.

⚠️ The elision above is the enumerated verification list, which is reproduced in full as the slice-2
acceptance criteria in `docs/reviews/ADR0077_DEPLOY_IDENTITY_CHECKPOINT.md` — 🚫 nothing was dropped
that changes the decision.

## 0.1 Why this ADR exists

ADR-0076 asked whether a compromise of AGE Studio could reach a peer. It answered that question and
closed it: the console is containerised, runs unprivileged, sits on a network carrying only AGE's own
store, and every deploy re-proves by raw TCP connect that no peer database answers.

**This ADR is about the other direction, which ADR-0076 never examined**: not what the _running
console_ can reach, but what the _account that deploys it_ can reach. Those are different identities
with different blast radii, and only the first one has ever been measured.

The Product Owner asked for the audit directly:

> _"AGE should be publicly usable at age.digitaldadi.agency, while compromising AGE Studio must not
> provide a practical path to peer applications, peer databases, or peer secrets, and the AGE
> deployment account itself should not have unnecessary root-equivalent access."_

⚠️ **The first half of that sentence is already true and this ADR does not improve it.** The second
half is not true today. That asymmetry is the whole subject here, and §7 states it plainly so no
later reader mistakes this ADR for a fix to something it does not touch.

## 0.2 What was measured (2026-08-16, on the real VPS, read-only)

🚫 Not inferred from configuration. Every line below was executed on the box.

1. **The AGE deploy account is `drishti`, and it is root-equivalent twice over.** `sudo -n -l`
   reports `(ALL : ALL) ALL` and `(ALL) NOPASSWD: ALL`; `id` reports membership of group `988(docker)`
   and `27(sudo)`. Either one alone is root: `docker run -v /:/host` needs no sudo at all.
2. **`drishti` is the shared owner of every other product on the host.** `/opt/rankops`,
   `/opt/snara`, `/opt/dd-agency`, `/opt/dd-scanner` are all `drishti`-owned. It is not an AGE
   account that happens to be broad; it is the box's general-purpose application account.
3. **Nothing declares `drishti` as AGE's deployment identity.** `AGE_VPS_USER` is a `require`d
   variable with no default (`deploy-studio.sh:51`), and the literal string appears in shipped code
   only in usage comments and in guard fixtures naming the _Drishti product's_ Docker networks.
4. **AGE's own files are correctly scoped already.** `/var/lib/age-operator` is `0700` with `0600`
   contents; `/etc/age-studio` is `0750 root:drishti` with `0600` members; the checkout carries no
   `.env` at all — only `.env.example`.
5. **The container boundary is intact.** `age-studio` runs `1001:1001`, `Privileged=false`,
   `no-new-privileges`, two read-only bind mounts and nothing else, on `age-internal`, whose only
   members are `age-postgres` and `age-studio`.
6. **A stale root-owned AGE tree exists at `/opt/age`** (Aug 15), with no compose directory and no
   env file. Nothing references it: a grep of `/etc/systemd/system`, `/etc/nginx`, `/etc/cron.d`,
   `/etc/logrotate.d` and the cron spool for `/opt/age` returns zero hits.
7. **`age-studio.service` still exists, disabled.** It is the pre-ADR-0076 host process —
   `User=drishti`, `WorkingDirectory=/home/drishti/age`. `provision-studio-database.sh:366` still
   contains a live `sudo systemctl restart ${SERVICE}` pointing at it.

### 0.2b ⚠️ ERRATUM — ADR-0076 §0.2 ITEM 6 IS FALSE, AND WAS FALSE WHEN WRITTEN

ADR-0076 §0.2 item 6 records: _"No peer credential is readable by the service account. Its home
contains only AGE's checkout; the peers' env files are root-owned."_

🛑 **The peers' env files are not root-owned.** Measured 2026-08-16:

```
-rw------- 1 drishti drishti 1574 /opt/rankops/.env
-rw------- 1 drishti drishti 3070 /opt/snara/.env
-rw------- 1 drishti drishti  533 /opt/dd-agency/.env
-rw------- 1 drishti drishti 2102 /opt/dd-scanner/.env
```

All four were read successfully as `drishti`, without `sudo`. `0600` is doing nothing here, because
`drishti` **is** the owner.

⚠️ **The error did not change ADR-0076's conclusion** — that ADR is about the containerised console,
which still cannot read any of these — but it is exactly the kind of claim that gets carried forward
as settled. It is corrected here rather than quietly. 🚫 Do not cite ADR-0076 §0.2 item 6 again.

---

## 1. Decision

### D1 — AGE gets a dedicated deployment identity, `age-deploy`, and stops using `drishti`

A Linux user `age-deploy` owns AGE's checkout and AGE's operator data, and is the only identity that
deploys AGE. `AGE_VPS_USER=age-deploy`, `AGE_VPS_PATH=/home/age-deploy/age`.

🚫 **It is not in the `docker` group.** 🚫 **It has no unrestricted sudo.** 🚫 **It gets no access
to `/opt/rankops`, `/opt/snara`, `/opt/dd-agency`, `/opt/dd-scanner`, or any of their secrets** — and
this requires no action beyond not granting it, since those trees are `drishti`-owned `0600`/`0750`
and `age-deploy` is in no group that reaches them.

### D2 — The Docker socket is reached through fixed-argument wrappers, never through the group

🛑 **`docker` group membership and `sudo docker <free arguments>` are the same privilege as root**,
because both permit `-v /:/host`. Neither is an acceptable narrowing, and 🚫 neither may be
introduced later as a convenience.

AGE's Docker surface is small and fully enumerable — one compose file, two container names, one
probe shape — so it is expressible as fixed wrappers. That is the only reason D2 is possible; it is
🚫 not a general technique to reach for elsewhere.

### D3 — The four wrappers, their exact fixed arguments, and what they refuse

Root-owned `0755 root:root`, in `/usr/local/sbin`, **not writable by `age-deploy`** (D6 guard 4).
Each is `set -euo pipefail`. Every path below is a **literal inside the wrapper**, 🚫 never an
argument, 🚫 never an environment variable read from the caller.

**1. `/usr/local/sbin/age-deploy-compose-up`** — takes **no arguments**; refuses if given any.

```
docker compose -f /home/age-deploy/age/deploy/vps/compose/docker-compose.studio.yml up -d --build
```

`AGE_STUDIO_UID`/`AGE_STUDIO_GID` are derived **inside the wrapper** by `stat` on
`/var/lib/age-operator/clients.json`, keeping ADR-0076's rule — the console runs as the owner of the
file it must open, 🚫 never a chosen or defaulted uid — and refusing uid 0. 🚫 The caller does not
supply them, because a caller-supplied uid is a caller-supplied privilege.

**2. `/usr/local/sbin/age-deploy-derive-env`** — takes **no arguments**; refuses if given any.

Replaces the `sudo sh -c "…"` at `deploy-studio.sh:126`, which is a root shell rather than an
operation. Reads `/etc/age-studio/age-studio.env`, applies the one fixed substitution
`@127.0.0.1:5442/` → `@172.23.0.2:5432/`, writes `/etc/age-studio/age-studio.container.env`, then
`chmod 600` and `chown age-deploy:age-deploy` on it. Refuses if the source is absent, or if the
result does not contain `@172.23.0.2:5432/`.

🚫 **It never prints, echoes, logs or returns the value** (ADR-0076 D6 preserved). 🚫 It writes
exactly one path and takes no pattern from the caller — a caller-supplied `sed` expression is a
caller-supplied arbitrary root write.

**3. `/usr/local/sbin/age-deploy-nginx-apply`** — reads the vhost **on stdin**; takes **no
arguments**; refuses if given any.

The hostname `age.digitaldadi.agency` is a **literal inside the wrapper**. It writes only
`/etc/nginx/sites-available/age.digitaldadi.agency`, symlinks it into `sites-enabled`, runs
`nginx -t`, and reloads nginx only if that passes — restoring the previous file if it does not.

🛑 **The hostname must not be an argument.** `sudo tee "$VARIABLE"` as written today
(`expose-studio-public.sh:117,158`) permits writing **any** peer's vhost, which is a route to
serving a peer's hostname from an AGE-controlled upstream.

**4. `/usr/local/sbin/age-deploy-docker-probe`** — the only wrapper taking arguments, and they are
**enumerated, not free**: a verb from `{inspect, logs, exec-probe, ps}` and a container name from
`{age-studio, age-postgres}`. Anything else refuses.

`exec-probe` runs a **fixed** Node probe inside `age-studio` — the ADR-0076 D7 raw-TCP peer
reachability check and the `/sign-in` health check — 🚫 not caller-supplied script text.

⚠️ Even had the script text been caller-supplied, it would execute as **uid 1001 inside the
unprivileged container**, granting nothing the container does not already have. It is fixed anyway,
because "harmless today" is not a property that survives an image change.

### D4 — Certbot gets no wrapper and no sudoers entry

`/etc/letsencrypt` is `root:root 0700` and `certbot.timer` renews as root on the system schedule
(measured: next run 2026-08-16 20:35, last 04:29). The deploy identity is not part of renewal.

🛑 **`sudo certbot <free arguments>` is unrestricted root** — `--deploy-hook` runs arbitrary commands
as root. Issuance for a **new** hostname is an owner act performed by hand, 🚫 not a deploy step, and
🚫 no wrapper is added for it.

### D5 — What moves, and what must not be touched to make it move

`/var/lib/age-operator` is `chown -R` to `age-deploy`. 🛑 **Ownership only.**
🚫 **No `chmod`, and specifically 🚫 never `o+r`** — widening a real business's client record on a
shared host is the exact thing `0600` exists to prevent (ADR-0053 D3, ADR-0076's refusal by name).

The uid the container runs as follows automatically, because it is derived by `stat` from that file.
🚫 No compose literal is introduced.

`/etc/age-studio` is `chgrp age-deploy` at `0750`; `age-studio.container.env` is chowned to
`age-deploy`; `age-studio.env` and `age-postgres.env` stay `root:root 0600`.

**Removed as residue:** the `/opt/age` tree (§0.2 item 6 — nothing references it), and
`age-studio.service` (§0.2 item 7 — a disabled but re-armable host process of exactly the kind
ADR-0076 D1 removed, plus the dead `systemctl restart` line that still points at it).

### D6 — Six guards, each asserting a thing that is invisible when it breaks

Every guard must be **made to fail** before it counts as evidence (§8 tripwire): mutate what it
protects, confirm it names the mutation, restore with a targeted inverse edit — 🚫 never
`git checkout <file>`.

1. **`age-deploy` is in no group but its own.** Asserts `id age-deploy` reports exactly
   `age-deploy`, and specifically 🚫 not `docker` and 🚫 not `sudo`. Group membership is silent,
   survives reboots and grants root — nothing else on the box would report it.
2. **`age-deploy` has no unrestricted sudo.** Asserts `sudo -l` for `age-deploy` lists exactly the
   four wrapper paths and 🚫 contains no `ALL`, no `(ALL : ALL)`, no shell, and no `docker`,
   `nginx`, `certbot`, `systemctl`, `sh`, `bash`, `tee` or `install` as a directly permitted command.
3. **No wrapper takes a caller-controlled path.** Scans each wrapper's source and asserts every
   path under `/etc`, `/var`, `/home` and `/usr` is a **string literal**, and that no `$1`, `$@`,
   `$*` or `${…}` expansion reaches a path position, a `tee`, an `install`, a redirect target or a
   `-f` compose argument. ⚠️ **Comments are stripped before scanning**, or a wrapper's own
   explanation of the rule matches it (the `vitest-worker-cap.spec.ts` lesson).
4. **No wrapper passes caller arguments to `docker`, `nginx`, `certbot` or `systemctl`.** Asserts
   wrappers 1–3 reject any argv at all, and that wrapper 4's argv is validated against the two
   enumerated allowlists **before** reaching `docker`, with a default-refuse branch.
5. **Wrappers are not writable by `age-deploy`.** Asserts each is `root:root`, mode `0755`, that
   `/usr/local/sbin` is `root`-owned and not group- or world-writable, and that no wrapper is a
   symlink into a tree `age-deploy` can write. 🛑 A wrapper `age-deploy` can edit is not a boundary;
   it is a suggestion.
6. **The walk found something.** Each guard above first asserts its own scan located the expected
   number of files and that the count is non-zero — 🚫 an empty scan must never be able to report
   compliance (§8, the standing guard-test rule).

⚠️ Guards 1, 2 and 5 are **host** facts, not repository facts, so they run as a verification step in
the migration slice against the real box, and their output is recorded. 🚫 A repository test cannot
assert them and must not pretend to.

### D7 — Rollback: the previous identity is restored, not rebuilt

🛑 **`drishti` is not deleted, and its AGE checkout is not removed, until the new identity has been
verified on the real box.** Rollback is therefore a re-point, not a reconstruction:

1. `AGE_VPS_USER=drishti`, `AGE_VPS_PATH=/home/drishti/age` on the workstation.
2. `chown -R drishti:drishti /var/lib/age-operator` (ownership only — 🚫 no `chmod`).
3. `chgrp drishti /etc/age-studio`; `chown drishti:drishti /etc/age-studio/age-studio.container.env`.
4. `git revert` the script changes, or deploy from the prior commit — the old scripts' `sudo` paths
   still work for `drishti`, whose sudo rights this ADR does not alter.
5. Re-run `bash scripts/deploy-studio.sh` with the old variables; the derived uid follows the
   restored ownership automatically.
6. Leave the wrappers and the sudoers drop-in in place, or remove them — 🚫 neither affects
   `drishti`, which does not use them.

⚠️ **AGE Postgres is not in the rollback path.** `age-postgres` uses the named volume
`age_postgres_data` with no host bind and no uid derivation, so no step above touches its data. The
same is true forward: 🚫 the migration must never `chown` a Docker volume.

⚠️ **nginx and TLS are not in the rollback path either.** The vhost is byte-identical and proxies to
`127.0.0.1:3100`; `/etc/letsencrypt` is untouched by any identity change (D4).

### D8 — The public URL stays public

🚫 `https://age.digitaldadi.agency` is not taken down, not made private, and not put behind a second
authentication for the duration of this work. If a migration step would require that, the step is
wrong and the migration stops instead.

---

## 2. What this ADR explicitly does NOT claim

🛑 **Read this section before citing this ADR as a security improvement.**

### 2.1 🚫 It does not solve `drishti`'s root-equivalent access to the other products

After this ADR, `drishti` still has `(ALL) NOPASSWD: ALL`, still belongs to the `docker` group, and
still owns `/opt/rankops`, `/opt/snara`, `/opt/dd-agency`, `/opt/dd-scanner` and all four `.env`
files. **Nothing here shrinks that account.**

What changes is only that **AGE no longer contributes to it** — AGE's deploy key stops landing on a
root-equivalent shared account. The peer-side account is peer territory, and 🚫 AGE may not redraw
it. That is a separate decision for the owner, and 🚫 this ADR must never be cited as having made it.

### 2.2 🚫 It does not resolve ADR-0076 D8

AGE's own store stays published on `127.0.0.1:5442` for the host-side capture CLI. A compromised
**peer** can still reach it. 🛑 **D8 is untouched, byte for byte**, and changing the deployment
identity does not narrow it at all.

⚠️ If anything this sharpens the question, because the capture CLI is the sole remaining reason that
publication exists — and it moves to `age-deploy` here, which is an account with _less_ reach than
the one running it today. 🚫 That is an observation, not a discharge of D8.

### 2.3 🚫 It does not improve the containerised console's isolation

ADR-0076's boundary is already what the owner asked for, re-proven on every deploy. An attacker who
owns the Studio process does not become `drishti` today and will not become `age-deploy` tomorrow.

🛑 **The threat this ADR actually closes is a different one: compromise of the AGE deployment
identity or its SSH key.** Today that key reaches an account that can read every peer secret on the
box — measured, §0.2b. That is the exposure, and 🚫 it is not the exposure ADR-0076 addressed.

---

## 3. Alternatives considered

**A. Leave it. `drishti` is the operator's own account.** 🚫 Rejected. It makes AGE's deploy key
equivalent to every peer's secrets, and the audit read all four `.env` files to prove the reach is
real rather than theoretical. It also leaves ADR-0076 §0.2 item 6 standing as a false claim.

**B. `age-deploy` in the `docker` group, no sudo.** 🚫 Rejected. Simpler and no narrower: the group
is root by another name (`-v /:/host`). It would let this ADR _claim_ a boundary it does not have,
which is worse than not having one.

**C. `age-deploy` with `NOPASSWD` for `docker`, `nginx`, `certbot`, `systemctl` as commands.**
🚫 Rejected. Free arguments to any one of those four is root: `docker run -v /`, `certbot
--deploy-hook`, `systemctl link` an attacker-controlled unit. This is the shape that _looks_ narrow
in a sudoers file and is not.

**D. Fixed-argument root wrappers (chosen).** The only option where the sudoers entry means what it
appears to mean. Its cost is honest and worth stating: **four more root-owned files to maintain**,
and a deploy that fails confusingly if a wrapper drifts from the script that calls it. D6 guard 3
and guard 4 exist because that drift is the realistic failure mode.

**E. Full rootless Docker for AGE.** 🚫 Rejected for now — 🚫 not on merit, but because it would
move `age-postgres` to a new storage location and put existing data in the migration path, which
this slice explicitly refuses (D7). Revisitable on its own ADR.

---

## 4. Consequences

- AGE's deploy key stops being a peer-secret key. This is the entire benefit.
- Four root-owned wrappers become part of AGE's deployment surface and must be kept in step with the
  scripts that call them. D6 guard 3/4 catch drift in shape; 🚫 they cannot catch drift in intent.
- The three deployment scripts get simpler at every point they currently reach for `sudo`, and two
  `sudo` calls disappear entirely as redundant (`deploy-studio.sh:140`, `expose-studio-public.sh:183`
  — both discard the only field root provides).
- A failed migration is recoverable in six steps that touch no data (D7).
- 🚫 The host still carries one root-equivalent shared account. This ADR does not pretend otherwise.

## 5. What this ADR does not authorize

🚫 Changing `drishti`'s sudo rights, group membership, or ownership of anything under `/opt`.
🚫 Touching any peer container, network, vhost, certificate or `.env`.
🚫 Any `chmod` on operator data (D5).
🚫 Any change to AGE Postgres storage, or any `chown` of a Docker volume (D7).
🚫 Rootless Docker (alternative E — its own ADR).
🚫 A second authentication in front of the public URL (D8), or taking it down.
🚫 Discharging ADR-0076 D8 (§2.2).

---

## 6. Slices

**Slice 1 — this ADR.** Records the decision and the erratum. 🚫 Authorizes no host change.

**Slice 2 — the migration**, only after acceptance: create `age-deploy`, install the four wrappers
and the sudoers drop-in, move ownership of the operator data and the two `/etc/age-studio` entries,
re-point the three scripts at the wrappers, deploy as `age-deploy`, remove the two pieces of residue,
then verify on the real box and report **only what was actually proven**.

⚠️ **THE BROWSER IS A GATE THE REPO DOES NOT HAVE** (ADR-0074's lesson — four defects survived every
local gate, CI, `curl` and the deploy script's own checks, and died on the first real page load).
🛠️ Slice 2 ends by opening `https://age.digitaldadi.agency` and signing in, 🚫 not by a green script.

---

## 7. The one-sentence summary a later reader will need

🛑 **This ADR narrows who can deploy AGE; it does not narrow what `drishti` can do, it does not
resolve ADR-0076 D8, and it does not improve the console's own isolation — which was already what
the owner asked for.**

## 8. Standing rules this ADR does not repeal

⚠️ A guard is evidence only once it has been **made to fail**; restore with a targeted inverse edit,
🚫 never `git checkout <file>`. ⚠️ A walk-the-repo guard must first assert the walk found files.
⚠️ Strip comments before scanning source for a banned token. 🛑 A cached gate is not a gate — a slice
touching import topology runs `npx nx run-many -t test --skip-nx-cache`. 🚫 Real client records are
never committed, never widened, and a name in prose is client data too.
