# ADR-0075 — AGE's own database: a dedicated container, and the boundary a peer may never cross

Status: **Accepted** (2026-08-15) — ⚠️ **BY THE PRODUCT OWNER, 🚫 NOT SELF-ACCEPTED.**
⚠️ **BOUNDED BY §0.3.** Read it before acting on any decision below.

⚠️ **IT NOW AUTHORIZES PROVISIONING, AND NOTHING BEYOND IT.** It records a decision the Product
Owner stated (§0.2), pins a standing principle they asked to have pinned (D6), and was accepted in
their own words on 2026-08-15 (§0.3) — a separate act, with a date. 🛑 **§2's refusals are NOT
lifted by the acceptance**: the public bind and the vhost are still ADR-0074 D9, still LAST, and
🚫 `age.digitaldadi.agency` is 🚫 not exposed by this ADR.

Amends (narrowly, and only this): ADR-0074 **§0.2 item 3** and **D8**'s first bullet.
Depends on: ADR-0061 **A5**, ADR-0074 **D8/D9**, ADR-0071 **D1/D5**, ADR-0069 **D3/D6**, ADR-0046
**D5**, ADR-0062 **D1**.
Supersedes: nothing. ⚠️ It **reverses nothing the owner refused** — it corrects a shape that turned
out to be unbuildable, and the correction is the owner's own.

---

## 0.1 Why this ADR exists: the selected shape does not exist on the box

ADR-0074 §0.2 item 3 recorded the owner's selection as:

> _"**The store is AGE's own database and its own role on the Postgres already running on the VPS.**
> 🚫 Not a second instance, 🚫 not a container."_

⚠️ **That sentence was written against a VPS nobody had inspected at that level.** Measured on
2026-08-15, on the real host:

- 🚫 **There is no PostgreSQL on the VPS host at all** — no `postgresql` package, no
  `/etc/postgresql`, no `postgres` user.
- ✅ Every PostgreSQL on the box is a **container**: one belonging to RankOps, one to SNARA, one to
  Drishti. The RankOps instance publishes no host port and is reachable only on a Docker bridge
  address; the SNARA instance is the one bound to `127.0.0.1:5432`.

🛑 **So "the Postgres already running on the VPS, not a container" names nothing.** Every way
forward crossed one half of item 3 or the other, which is why this was put back to the owner rather
than resolved quietly — ADR-0074's own instruction says _"Do not silently create a database
architecture if an ADR is required."_

⚠️ **The architect's recommendation was WRONG and is recorded as such** (finding 8: adopt a
council's — or an architect's — evidence and its conclusion separately). The recommended option was
to reuse the RankOps container. The owner rejected it and gave a reason the recommendation had
undervalued: **a shared database is a peer integration nobody designed.** See D6.

## 0.2 The Product Owner's decision (2026-08-15), verbatim

> _"Choose Option 3 — dedicated age-postgres container — but do not implement it yet. The actual VPS
> topology proves that ADR-0074 §0.2 item 3 cannot be implemented literally: there is no host
> PostgreSQL; all existing PostgreSQL instances are containerised. I am explicitly overriding the
> earlier deployment-shape constraint that excluded a dedicated PostgreSQL container. Before writing
> deployment code, record this as a narrowly scoped amendment/new Proposed ADR: AGE gets its own
> age-postgres container. AGE gets its own database and non-owner age_app role. AGE has no database
> access to RankOps, SNARA, Drishti or any other peer database. AGE's Postgres has its own volume
> and independent lifecycle. Do not reuse RankOps' Postgres container or volume. Do not install
> PostgreSQL directly on the VPS host. Bind the AGE database only to the private/local Docker
> networking boundary required by AGE. Do not expose PostgreSQL publicly. Do not make AGE depend on
> a peer container IP. Preserve the existing principle that peer products communicate with AGE
> through the AGE semantic contracts, never through database sharing. Stop after drafting the
> amendment/ADR. Do not provision the database until the decision is recorded and accepted._
>
> _One additional principle I'd pin now: AGE must never share a database with a peer product. Not
> RankOps today, not SNARA tomorrow, not Humantik later. The communication architecture should be:
> Peer → AGE contract → AGE intelligence → AGE projection → Peer; not: Peer → shared database →
> AGE."_

⚠️ **The override is the owner's own, and it is narrow.** It lifts one clause of one item — the
exclusion of a container — and 🚫 it lifts nothing else in ADR-0074. In particular D9 stands
untouched: 🛑 **the public bind and the TLS vhost still come LAST, with the boundary.**

## 0.3 The Product Owner's acceptance (2026-08-15), verbatim

> _"Accept ADR-0075 and proceed. Now implement the AGE database provisioning slice for the actual
> VPS topology. Provision a dedicated age-postgres container with: its own persistent volume, its
> own database, its own non-owner age_app role, no access to any peer-product database, no
> dependency on RankOps/SNARA/Drishti container addresses, no public PostgreSQL exposure. Correct
> scripts/provision-studio-database.sh so it cannot accidentally target 127.0.0.1:5432 or assume a
> host postgres user. Then deploy the current AGE main build and provision the store on the real
> VPS. Do not start Slice 2b or Slice 3 yet. […] Do not expose age.digitaldadi.agency yet. Public
> exposure remains the final step after authentication and isolation are proven. (all app on the vps
> is contaninersied, and so should AGE)"_

### 0.3b What the acceptance does and does **not** authorize

- ✅ **Authorized:** the dedicated `age-postgres` container, its volume, its database, its `age_app`
  role, the correction of `scripts/provision-studio-database.sh`, deploying the current `main` build
  to the VPS, and running ADR-0074 §7 slice 2's acceptance test against it.
- 🚫 **NOT authorized:** slice 2b · slice 3 · 🛑 **any public exposure of
  `age.digitaldadi.agency`** — the owner repeated that fence in the same breath as the acceptance,
  and 🚫 it is not softened by the store existing.
- ⚠️ **THE PARENTHETICAL IS NOT A LICENCE TO CONTAINERISE `apps/studio`.** _"all app on the vps is
  containerised, and so should AGE"_ was written about the **database** shape this ADR decides, and
  the reading that satisfies it is the one taken here: AGE's store is a container of its own like
  every other product's. 🛑 **Containerising the Studio APP is a different decision** — ADR-0057
  §0.6 records that `apps/studio` gets **no Dockerfile**, and 🚫 an architect may not lower that
  fence from a parenthetical. ⚠️ It is raised as an open question in §4, 🚫 not acted on.

## 1. What is decided

### D1 — AGE gets its **own** PostgreSQL container, its own volume, its own lifecycle

- ✅ A dedicated container for AGE and nothing else, with a **named volume of its own**.
- 🚫 **RankOps' container is not reused, and RankOps' volume is not reused.** Neither is SNARA's,
  neither is Drishti's, and neither is any peer's that appears later.
- 🚫 **PostgreSQL is not installed on the VPS host.**
- ⚠️ **"Own lifecycle" is the operative half.** A store sharing another product's container shares
  its restarts, its upgrades, its backups and its restores — and a restore is the case that matters:
  rolling RankOps back to yesterday would silently roll AGE back with it. 🛑 **A restore of a peer
  must never be able to move an AGE row.**

### D2 — Its own database and its own **non-owner** role, exactly as ADR-0074 D8 already required

- ✅ A database for AGE, and the `age_app` role: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`
  **`NOBYPASSRLS`**. ⚠️ `NOBYPASSRLS` is the attribute that keeps the row-level policies applying to
  the console's own connection at all.
- ✅ The **owner** connection is held by a human for the length of one migration command and 🚫 is
  never written into the service's environment (ADR-0074 D8, unchanged).
- 🚫 **This is still not an authorization.** Where a row may be stored is not who may read it
  (ADR-0046 D5). 🚫 RLS remains coherence, and 🚫 the isolation ADR-0074 owes is never proven by it
  and never by an empty result set.

### D3 — 🚫 **NO CROSS-PRODUCT DATABASE REACH, IN EITHER DIRECTION**

- 🚫 AGE's role has **no** access to RankOps', SNARA's, Drishti's or any other peer's database.
- 🚫 No peer role has access to AGE's.
- ⚠️ **This is now a property of the topology, not of a grant.** Separate instances make the reach
  impossible rather than merely ungranted — which is the difference between a fence and a promise.
  🛑 That is the strongest form the rule has ever had, and 🚫 it must not be weakened back into
  "same instance, different grants" for convenience.

### D4 — 🚫 **AGE MUST NOT DEPEND ON A PEER CONTAINER'S ADDRESS**

- 🚫 No AGE configuration may name a peer container, a peer network, or an address AGE only reaches
  because a peer happens to be running.
- ⚠️ **This is why the recommended option was refused, and the owner is right about it.** A bridge
  address like `172.21.0.2` is stable in practice and 🚫 not guaranteed: it is assigned by the
  neighbour's deployment, so AGE would acquire a silent dependency on a redeploy nobody told it
  about. A store that moves when a peer restarts is not AGE's store.
- ⚠️ A5 would have **permitted** that address (it qualifies as `private-interface`). 🛑 **Permitted
  by the rule is not the same as right**, and this decision records the difference deliberately.

### D5 — The store stays **private**, and 🚫 nothing here opens a door

- ✅ Bound only to the local/private Docker boundary AGE itself needs. 🚫 No published public port,
  🚫 no proxy, 🚫 no vhost.
- ✅ `DATABASE_URL_APP` continues to be delivered from a root-owned mode-0600 environment file, is
  🚫 never committed, and 🛑 **absent at start-up is a REFUSAL, never a default** (ADR-0061 A6 item
  2).
- ✅ `selectDeployedDatabaseComposition` remains the entry point, with the acknowledgement written
  out **in source** (ADR-0061 A5). 🚫 No `allowRemote` flag and 🚫 no quietly-permitting second
  function may appear to accommodate this ADR — the address AGE will use qualifies under the rule as
  it already stands, and 🛑 **if it did not, the answer would be a different address, never a looser
  rule.**
- 🚫 **No new table is authorized.** The existing migrations run against it and nothing else
  (ADR-0074 D8, unchanged).

### D6 — 🛑 **AGE MUST NEVER SHARE A DATABASE WITH A PEER PRODUCT.** The owner's pinned principle

> _"Not RankOps today, not SNARA tomorrow, not Humantik later."_

The communication architecture is:

**Peer → AGE contract → AGE intelligence → AGE projection → Peer**

and 🚫 **never** Peer → shared database → AGE.

- ⚠️ **This is not new; it is now written down where it can be cited.** ADR-0071 D1 already made the
  peer transport **operator-mediated**, ADR-0071 D5 pinned the carried key set, and ADR-0069 D3 made
  a relay something that **carries and does not keep**. A shared database would have defeated all
  three at once — silently, and without any of them being edited.
- 🛑 **A SHARED TABLE IS AN UNDESIGNED INTEGRATION.** It has no envelope, no version, no refusal
  path, no provenance and no admissibility decision. Every rule AGE enforces at its boundary —
  🚫 nothing is empty-by-omission, 🚫 relayed is not recorded, 🚫 arrival is never confirmation —
  lives in code a `SELECT` from another product walks straight past.
- 🚫 **A read-only grant to a peer is not an exception to this**, and 🚫 neither is "just for
  reporting", 🚫 "just for a dashboard", or 🚫 a shared read replica.
- ⚠️ It binds **both directions**: AGE may not read a peer's tables either. ⚠️ The #333/#334 round
  trip is the shape that is allowed, and it is the only one — `age.peer.v1` over an
  operator-mediated path, 🚫 not a connection string.

---

## 2. What this ADR does **not** decide

- 🚫 **It does not provision anything.** No container is created, no volume, no role, no database,
  and no migration is applied, until this ADR is **Accepted**. ⚠️ The owner said so in the same
  breath as the decision.
- 🚫 **It does not authorize the public bind, the vhost or TLS.** ADR-0074 D9 is untouched: those
  land LAST, with the boundary, and _"do not expose the Studio unauthenticated even temporarily"_
  still stands.
- 🚫 **It does not discharge ADR-0074 §7 slice 2's verification.** Slice 2 is merged (#345) and
  **implemented**; it is 🚫 not verified, because verification requires the deployed store this ADR
  is about. ⚠️ The honest sentence stays _"the boundary is implemented"_.
- 🚫 **It does not authorize a deployed WRITE path** beyond the one ADR-0074 D3 already required
  (`revokedAt` on logout). The deployed console still has exactly two READ doors.
- 🚫 **It does not decide backups.** ⚠️ A store with its own lifecycle needs its own backup, and
  🛑 AGE does not have one — that is a **residual, recorded here so it cannot be discovered later**,
  and it needs its own slice.
- 🚫 **It does not decide how the container is managed** (compose file, unit, image tag, upgrade
  path). That belongs to the provisioning slice, judged against this shape.

## 3. What a provisioning slice must do once this is accepted

⚠️ Recorded so the slice is judged against a written shape, 🚫 not so it is pre-authorized.

1. ⚠️ **`scripts/provision-studio-database.sh` is WRONG on this box and must be corrected, not
   worked around.** It runs `sudo -u postgres psql` on the host — a user that does not exist — and
   hardcodes `127.0.0.1:5432` into the environment file, which is **SNARA's** published port. 🛑 A
   script that would have written another product's address into AGE's connection string is exactly
   the class of error D6 exists to prevent.
2. ✅ The address AGE uses must be **AGE's own**, and must qualify under A5 on its own terms.
3. ✅ The role attributes stay the `ci-db.yml` ones, verbatim — 🚫 no drift between what CI proves
   and what production runs.
4. 🛑 **Each of ADR-0074 §6's nine gate items still owes a guard MADE TO FAIL.** 🚫 Provisioning a
   database discharges none of them.

---

## 4. ⚠️ OPEN QUESTION — should `apps/studio` itself be a container? 🚫 NOT DECIDED HERE

The acceptance's parenthetical — _"all app on the vps is containerised, and so should AGE"_ — is a
fair observation about the box: RankOps, SNARA, Drishti and the agency site all run as containers,
and AGE Studio is the one host process among them.

🛑 **BUT ADR-0057 §0.6 REFUSED A DOCKERFILE FOR `apps/studio` BY NAME**, and the reason was not
laziness: `apps/web` is a public surface and `apps/studio` was an operator console with **no
authentication boundary at all**, so an image that could be run anywhere was a way to run an
unauthenticated console anywhere. ⚠️ **Slice 2 changes that premise** — there is a boundary now — so
the refusal is worth revisiting on its merits.

🚫 **It is not revisited here, and 🚫 it must not be done as part of the provisioning slice.**
Reasons, recorded so the question is answered rather than drifted into:

- ⚠️ A container image for the console needs its own decisions: where `AGE_CLIENT_RECORD_FILE` and
  the discovery workspace live (they are **operator files** under ADR-0054 D2/D3, and a bind mount
  is a path), how the environment file reaches it, and 🛑 whether the loopback bind survives — a
  published container port is exactly the crossing ADR-0057 D2 refuses.
- ⚠️ Doing it now would mean the slice that proves the authentication boundary **also** changed how
  the app is executed. 🚫 A verification is worth much less when the thing verified moved underneath
  it.

🛠️ **It needs its own `Proposed` ADR, after slice 2 is verified.** ⚠️ Until then the console keeps
running from the systemd unit, and 🚫 that is a deferral, never a claim that the unit is the better
shape.
