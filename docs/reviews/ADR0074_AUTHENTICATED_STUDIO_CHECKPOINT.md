# ADR-0074 — the authenticated deployed Studio: track checkpoint

> The per-slice record for ADR-0074 (`Accepted`, bounded by its §0.3b). ⚠️ Read the ADR in its own
> words; this document records **what shipped, what was proven, and what each slice did NOT prove**.
> 🚫 Nothing here authorizes a later slice — the ADR does that, and §7 fixes the order.

---

## 0. THE ORDER, AND WHY IT IS NOT NEGOTIABLE

ADR-0074 §7, in order: **1 the store · 2 the session boundary · 3 the client switcher · 4 the public
bind + TLS.** The owner's acceptance fixes the tail of it in their own words:

> _"No public deployment before the authenticated boundary is verified. Do not expose the Studio
> unauthenticated even temporarily."_

🛑 **The public bind is LAST, and it lands together with TLS and the boundary — never before.**
🚫 A reverse proxy in front of the current console is the crossing ADR-0057 D2 names by hand.

---

## 1. THE COMPARISON DOCUMENT (#342, `a445e77`)

`docs/reviews/AGE_RANKOPS_ACCESS_MODEL_COMPARISON.md` — the §0.3 deliverable the owner required
**before any code**. Ten sections; **§8 is the operative half**: nine differences, each forced by an
existing AGE ADR rather than by preference. The three that most often stop an active mistake:

- **§8.3 — the boundary is composed in `apps/studio` ONLY.** 🛑 Not in shared middleware. AGE has
  other inbound surfaces (`apps/mcp`), and authentication middleware that generalises is how an
  unrelated tool's trust boundary changes without anybody deciding it. The owner refused exactly
  this by name.
- **§8.4 — the concrete defect on `main`:** `resolveBusinessScope(clientId)` is called straight off
  route params, so the chain today is **caller → clientId → database**. That is the shape
  AGE-INV-SEL-1 forbids, and slice 3 exists to break it.
- **§8.9 — in Studio a path is a tenancy boundary, not just a `where` clause.** 🚫 RankOps's pattern
  of trusting a selected organization on the request cannot be ported.

---

## 2. SLICE 1 — THE DEPLOYED STORE (#343, merged `b65b476`)

### 2.1 What it is

`apps/capture/src/deployed-console-composition.ts`: the **deployed composition root**, ADR-0061
**A5** wired for the first time. `apps/studio` now opens the deployed doors instead of the local
ones, and `scripts/provision-studio-database.sh` creates the database, the non-owner role and the
service's `EnvironmentFile` on the VPS.

🛑 **THIS IS THE STORE, NOT THE DOOR.** Nothing was exposed: no port opened, no proxy installed, no
vhost written. The SSH tunnel is still the only way in.

### 2.2 The gap it closed

`assertLocalDatabaseTarget` means _"this database is on the machine you are sitting at"_. On a VPS
**that sentence is false while its check still passes**, because loopback on a server is loopback
**on the server**. The console was running on the honest-sounding rule that had quietly stopped
being true.

### 2.3 Why a second file and 🚫 not a flag

A5 refuses an `allowRemote` parameter **by name** — _"the copy that gets relaxed still passes its
own tests."_ So there are **two names**: the local doors keep their strong claim, and the deployed
doors make a **weaker claim that is TRUE in both places** (loopback or a private interface, never a
public one). 🚫 Do not add a parameter to either that turns it into the other.

⚠️ **The console uses the deployed doors UNCONDITIONALLY.** An `if (process.env.DEPLOYED)` would
apply the honest rule exactly when somebody remembered to set a variable.

### 2.4 What is true BY SHAPE, not by promise

- 🛑 **Exactly two doors and both only READ.** No deployed capture door, no observation `append`
  door. A deployed AGE cannot write a client's rows because **the function does not exist**, not
  because a caller declines to call it. 🚫 Adding one needs its own ADR.
- 🛑 **The acknowledgement is written out in SOURCE.** `REMOTE_ACKNOWLEDGEMENT`'s literal type
  cannot be satisfied by a `string | undefined` read from an environment. **Writing it is the
  decision.** It lives in `operator-environment.ts` — the console's ONE effects module, and that is
  not incidental: a screen holding it could open a connection.
- 🛑 **The judgement runs ABOVE `new PrismaClient(`.** A check after construction has already handed
  the connection string to a driver that may dial on first use.
- 🚫 **No credential and no URL appears in any refusal** — refusals name a VARIABLE or a HOST.
- ⚠️ **Two roles stay two.** The owner URL is held by the human for the length of one
  `prisma migrate deploy` (🚫 never `migrate dev`) and is **never written into the unit file**. The
  service runs as non-owner `age_app` — `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, the
  ci-db.yml attributes verbatim. `NOBYPASSRLS` is the one that keeps the policies applying at all.
- ⚠️ `EnvironmentFile=/etc/age-studio/age-studio.env` has **NO leading `-`**: an absent secret
  **stops the service** (ADR-0061 A6 item 2). 🚫 Nothing is defaulted and no password is generated —
  a generated secret is a secret nobody can rotate.

### 2.5 🚫 WHAT SLICE 1 DID NOT PROVE

🛑 **IT AUTHORIZES NOTHING.** Where a row may be stored is **not** who may read it (ADR-0046 D5,
ADR-0055 D9). The reads are subject to row-level policies rather than exempt from them — but **RLS
is COHERENCE**, and 🚫 the isolation ADR-0074 owes is proven by **neither RLS nor an empty result
set**. The console still has **no login, no session and no entitlement check**.

### 2.6 The guards, each made to fail before it was trusted

| Mutation                                                                             | What failed, by name                                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `append: (o) => repository.append(o)` injected into the observation door             | `expected '…' not to contain 'append'` **and** `expected [ 'append', 'close', … ] to deeply equal [ 'close', 'listForOrganization' ]` |
| The console's import swapped back to `@age/capture/composition`                      | the new effect-isolation guard, on both its assertions                                                                                |
| A third file importing `@age/deployed-database-target` added under `apps/studio/src` | `expected 3 to deeply equal 2`                                                                                                        |

⚠️ All restored with **targeted inverse edits**, 🚫 never `git checkout <file>`.

### 2.7 🛑 THE LESSON THAT COST A RED CI RUN — **A CACHED GATE IS NOT A GATE**

`pnpm test` reported **59 projects green** over a guard **it never executed**. Nx served
`@age/deployed-database-target` from cache because none of _that project's own files_ had changed —
but its guard **reads other packages' source**, so a change outside it invalidates the guard's
_meaning_ without invalidating the _cache entry_. CI, which has no warm cache, failed on it.

🛠️ **ANY SLICE THAT CHANGES IMPORT TOPOLOGY MUST RUN THE TEST GATE WITH THE CACHE BYPASSED:**
`npx nx run-many -t test --skip-nx-cache` (⚠️ `pnpm test --skip-nx-cache` is rejected by pnpm — the
flag never reaches Nx). This generalises to **every walk-the-repo guard in this repository.**

⚠️ The guard that caught it said _"imported by nothing on the deployment path **yet**"_, and its own
comment named the fix: **update it deliberately in the slice that breaks it, never delete it.** It is
now an **EXACT two-item list**, 🚫 not a relaxation to "at least one" — a third importer must fail
and be argued for in an ADR rather than discovered later.

---

## 3. 🛠️ WHAT SLICES 2–4 STILL OWE

- **Slice 2 — the session boundary, STILL ON LOOPBACK.** Cookie → `verifyPresentedSessionToken` →
  `VerifiedSession`, composed in front of **every** Studio route. 🛑 **Unauthenticated access must be
  denied BEFORE any protected data query executes.** Login accepts a **pasted operator-provisioned
  token** (🚫 AGE mints nothing — ADR-0068 §0.1c, ADR-0074 D4). 🛑 **LOGOUT WRITES `revokedAt`** — a
  logout that only clears the cookie is not a logout. Plus expiry, rate limiting on the verify
  route, and **audit (ADR-0061 A6 item 6, the only empty gate item)**.
  🛠️ Also owed here: **a guard asserting `apps/mcp` imports nothing from the session/entitlement
  boundary**, and **a route contract test that FAILS until a new route is classified**.
- **Slice 3 — the client switcher AS A FILTER.** Registry-resolved `clientId → organizationId`, then
  `readWithinEntitlement` on the **organization**. 🛑 **AGE-INV-SEL-1**: a forged `clientId` is a
  **no-op, never an escalation** — and that needs its own test. Every `/b/[clientId]/*` route
  re-derives entitlement **independently**; 🚫 no trusted shared "current client". One **opaque**
  refusal. This is where §8.4's defect is actually fixed.
- **Slice 4 — the public bind and the nginx vhost for the owner's subdomain, LAST and TOGETHER.**
  `.well-known/acme-challenge/` above the redirect; `real_ip_header X-Forwarded-For` **overwritten,
  not appended**.
- 🛠️ **Replace _"The tunnel is the authentication"_ in `scripts/deploy-studio.sh`** in the slice that
  makes it false — ⚠️ **it is still TRUE today**, and a document claiming a boundary that does not
  exist is the dishonest half of the rule, not the safe half.
- 🛑 **The definition of done is proven against REAL data and REAL running paths, 🚫 not mocks** —
  including a real cross-client attempt **denied before a query exists**.

🚫 **The ecosystem/peer track stays SUSPENDED** until the deployed Studio can be opened and used as
the real product. The owner said so in their own words.
