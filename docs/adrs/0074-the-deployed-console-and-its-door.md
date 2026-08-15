# ADR-0074 — The deployed console and its door: an authenticated Agency Admin, and a selection that grants nothing

Status: **Proposed** (2026-08-15)

🛑 **THIS ADR REVERSES REFUSALS THE PRODUCT OWNER SET, AND THAT IS THE WHOLE REASON IT EXISTS.**
🚫 It must **NOT** be self-accepted. Three of the four reversals in §3 are the Product Owner's own
recorded answers — ADR-0061 §5-B and ADR-0068 §0.1c — and the architect may not lower a fence the
owner raised. ⚠️ The owner has stated the intent (§0.1) and selected the three shapes (§0.2); what
is missing is the **acceptance**, which is a separate act with a date.

Reverses (each **narrowly**, and each named): ADR-0061 **§5-B** · ADR-0057 **D2 / OX-INV-1**
(bounded — see D2) · ADR-0068 **§0.1c** items 2 and 3 (the login route + session issuance, and the
switcher).
Depends on: ADR-0061 **A2/A3/A4/A5/A6**, ADR-0062 **D1–D4**, ADR-0068 **§0.1b/§0.1d**, ADR-0058
**D1/D2**, ADR-0046 **D5**, ADR-0053 **D3/D4**, ADR-0054 **D2/D3**, ADR-0057 **D4**.
Supersedes: nothing.

---

## 0.1 The Product Owner's instruction (2026-08-15), verbatim

> _"Stop treating SSH tunnelling as the eventual AGE login experience. We need to move AGE toward
> the same operator access model already established in RankOps: Super Admin → Agency Admin →
> Client switcher → Client-scoped workspace. For V1, authenticated humans are operators. A Client
> remains a data/tenant subject, not an authenticated principal. Do not reopen the earlier
> Client-login decision. Preserve the security invariant: 'Client selection can narrow access,
> never grant access.' The selected clientId must never itself establish authorization. Every
> protected route/API/read must independently verify the operator's entitlement to that client. …
> Do not put nginx/reverse proxy in front of the existing unauthenticated Studio as a shortcut.
> Public deployment must come only after AGE has an actual authentication boundary."_

⚠️ **Three things in that instruction are decisions, and they are recorded as the owner's, not the
architect's:** the access model is RankOps' · the invariant is the owner's sentence · and 🛑 **the
ordering — auth boundary BEFORE public exposure — is an explicit refusal of the shortcut**, which
matters because the shortcut is cheap, available today, and would be permanent the moment anyone
found the URL.

🚫 **The Client-login question is NOT reopened.** ADR-0062 **D2** recorded a client as a subject of
isolation; the owner has now said plainly that a Client is 🚫 not an authenticated principal in V1.
That is a narrowing of D2's open edge, 🚫 not a reversal of it.

## 0.2 The three shapes the owner selected (2026-08-15)

⚠️ Selected from options the architect wrote, each with its cost stated. **Agreement is not
independent corroboration** (finding 7): the framing was the architect's, and if the shapes were
wrong this ADR carries that error forward.

1. **The reversal is put as an ADR, and the owner accepts it** — 🚫 not self-accepted, 🚫 not
   treated as pre-authorized by the instruction in §0.1.
2. **The credential is A1, unchanged: the operator pastes the out-of-band provisioned token once.**
   🚫 Not a password (ADR-0068 Question A option A2, 🚫 not chosen). 🚫 Not OIDC (A3, 🚫 not chosen).
3. **The store is AGE's own database and its own role on the Postgres already running on the VPS.**
   🚫 Not a second instance, 🚫 not a container.

---

## 1. Why this ADR exists

Every primitive the owner asked for **already exists on `main`**, and 🛑 **not one of them is
called by the deployed console.** That is the finding, and it is worth stating precisely because it
changes what the work is:

`grep -r 'readWithinEntitlement\|@age/session-cookie\|@age/entitled-read\|VerifiedSession' apps/`
returns **zero matches**.

What exists, unused: `@age/entitlement` (three-valued, org-is-tenant, no bypass arm) ·
`@age/entitled-read` (`readWithinEntitlement` — the entitlement answered **before** a query is
constructed, a denial **raised** rather than returned as `[]`) · `@age/session-store` ·
`@age/session-store-persistence` (the lookup behind a presented token, #322) · `@age/session-cookie`
(`__Host-`, HttpOnly/Secure/SameSite=Strict) · `@age/auth-rate-limit` · `@age/tenant-isolation` ·
`@age/tenant-workspace` · `@age/deployed-origin` · `@age/deployment-secrets` ·
`@age/deployed-database-target` · the `20260811000000_operator_sessions` migration **and its RLS
migration**.

⚠️ **So this is a WIRING decision wearing an architecture decision's clothes** — except for the
part that genuinely is one: the console may not be reached from a browser at all, and the reasons
are the owner's own.

🛑 **THE SHORTCUT IS REFUSED BY NAME, AGAIN.** `scripts/deploy-studio.sh` already says it: _"🚫 DO
NOT 'just add nginx' to make the URL nicer. That is the crossing."_ ⚠️ An nginx vhost in front of
today's console is not a smaller version of this ADR — it is the **whole exposure with none of the
boundary**, and it is unrecoverable, because everyone who found the URL was an operator before
anybody noticed.

## 2. What is NOT in question

- 🚫 **NO BUSINESS-OWNER / CLIENT LOGIN, AND NO PREPARATORY WORK FOR ONE.** ADR-0068 §2 enumerated
  it — routes, models, permissions, UI, abstractions — and the owner has just reaffirmed it in
  §0.1. 🚫 Not a `principalType` arm "for later", 🚫 not a client-scoped entitlement shape nothing
  calls, 🚫 not a screen behind a flag. ⚠️ _"Future compatible"_ is the **named failure mode**.
- 🚫 **THE V1 BOUNDARY IS UNCHANGED — read / browse / inspect / understand.** An authenticated
  Agency Admin is an authenticated **reader**. ADR-0057 **D4 class 3 stays refused, not postponed**,
  and a "preview" or "dry run" is still class 3.
- 🚫 **A `VerifiedSession` IS NOT AN `OperatorPrincipal`** and neither is ever promoted into the
  other (ADR-0053 D4, ADR-0061 A2).
- 🚫 **A session carries no role, no `isAdmin`, no permission list** (ADR-0062 D3). ⚠️ "Agency
  Admin" in this ADR names **what a human is doing**, 🚫 not a flag on a row. See D6.
- 🚫 **`not-established` never collapses to `denied` or to `false`** (ADR-0058 D2), and 🚫 no
  `not-assessed` becomes an answer because somebody logged in.
- 🚫 **RLS is coherence, not authorization** (ADR-0046 D5), and 🚫 it is never the isolation proof.
- 🚫 **NO PROVISIONING SURFACE** (ADR-0068 §0.1c item 1, **NOT** reversed — see D4).
- 🚫 **ADR-0055 D7 stays undischarged.** This is a read path and 🚫 does not become a capture write.
- 🚫 **DO NOT SEED A ROW** — not a session row, not a snapshot row. A seeded row makes the first
  real proof a proof of the seeding.
- 🚫 **REAL CLIENT RECORDS ARE NEVER COMMITTED** (ADR-0053 D3), and _"private is not a control"_.

## 3. The invariant this ADR is built around

🛑 **THE OWNER'S SENTENCE IS THE INVARIANT, AND IT GETS A NAME SO IT CAN BE CITED:**

> **AGE-INV-SEL-1 — a client selection can NARROW access, never GRANT it.**

⚠️ Stated as a property of the code rather than an intention: **the set of things visible after a
selection is a SUBSET of the set visible before it.** 🚫 There must be no branch anywhere that adds
a business to anyone's view because it was selected. If that ever inverts, a forged or guessed
`clientId` becomes an **escalation** instead of a **no-op**, and the whole safety argument of this
ADR is void.

⚠️ **This is RankOps' rule, adopted deliberately and with attribution.** `tenant-selection.ts` in
that repository states it as _"a selection is a FILTER, never a grant"_ and carries the reasoning
for why the transport may be a header: _"the header is a REQUEST for a filter; this module is what
decides it, server-side, every time."_ 🚫 The **code** is not copied — different framework,
different domain, different tenancy model. The **shape** is.

---

## 4. Decisions

### D1 — The hosted product is AGE Studio, deployed and authenticated. ADR-0061 §5-B is reversed.

§5-B read: _"🛑 AGE STUDIO IS NOT DEPLOYED… Deploying Studio would be a **reversal**, needing its
own ADR and the six auth slices that are still uncalled."_ ⚠️ **This is that ADR**, and §5-B named
the price correctly: the six A6 slices are the gate (§6), 🚫 not a follow-up.

🚫 **The read-only demo (`apps/web` + `apps/api`) is untouched and keeps its own refusals** —
ADR-0061 §5-C (no real business, ever) and §5-D (🚫 it must not grow a login). ⚠️ Two hosted
surfaces now exist and they are 🚫 **not** variants of each other: one holds nothing private and has
no door; the other holds real clients' data and is nothing but a door.

### D2 — OX-INV-1 is reversed for `apps/studio` ONLY, and replaced — 🚫 not merely relaxed

ADR-0057 D2 said the console binds `127.0.0.1` or refuses to start, _"no flag, no environment
override, no degraded mode"_. ⚠️ **The reason it existed is the reason it may now change:** D2 was
protecting a console with **no authentication of its own**, and it said so — _"whoever can reach
the port is the operator."_ A console that authenticates does not need the port to be its door.

🛑 **THE INVARIANT IS REPLACED, NOT DELETED, AND THE REPLACEMENT IS STRICTER TO WRITE:**

> **OX-INV-1b — the console binds loopback UNLESS a verified-session boundary is composed in front
> of every route, and it refuses to start if it cannot prove one is.**

- 🚫 **NOT a flag, NOT an environment override, NOT a degraded mode** — the same three words D2
  used, and for the same reason. The public bind is selectable only by a **separate named
  deployment composition** whose identity is in its name, exactly as
  `selectDeployedDatabaseComposition` is (ADR-0061 A5). ⚠️ **The precedent is deliberate:** that
  pattern already survived one attempt to make it configurable, and _"the copy that gets relaxed
  still passes its own tests."_
- ⚠️ **The existing `boundHost()` defect is instructive and must not recur** (#/`operator-environment.ts`):
  an env read there let the console **report a host no policy had accepted**, and the D2 guard's
  blind spot was that it scanned `package.json` and `project.json` only. 🛑 **The new guard must
  scan source too**, and 🚫 a reported value that the policy never saw is the defect, not a display
  bug.
- 🚫 **The public bind and the auth boundary are ONE composition, not two settings.** It must be
  impossible to express "bound publicly, unauthenticated" — 🛑 not refused at runtime, **not
  expressible**. ⚠️ That is what stops the shortcut from being reachable by deleting one line.

### D3 — Verification may set a cookie. ADR-0068 §0.1c item 2 is reversed, by one inch.

ADR-0068 §0.1b already permitted **verification** on a read path and refused **issuance**:
🛑 _"VERIFICATION IS NOT ISSUANCE."_ ⚠️ **That distinction survives this ADR and is what bounds it.**

What is now permitted, exactly:

- ✅ **One route that accepts a presented token, verifies it against the hashed row, and — only on
  success — returns `Set-Cookie` with the session reference.** The cookie is
  `serializeSessionCookie`'s output and 🚫 nothing else.
- 🛑 **AGE STILL MINTS NO CREDENTIAL.** The token is minted **out of band, by an act** (A1, ADR-0068
  §0.1a B). ⚠️ **The row is created by the developer, once, deliberately** — the route reads a row
  it did not write, and 🚫 it must be impossible for that route to create one. See D4.
- ⚠️ **What the cookie carries is a REFERENCE, never a claim** — `@age/session-cookie` already
  enforces this, and 🚫 no organization, account, role or expiry may be added to it.
- 🛑 **CLEARING THE COOKIE IS NOT REVOCATION.** Revocation is `revokedAt` on the row, and 🚫 nothing
  on this path may be described as ending a session.
- 🚫 **NO PASSWORD, NO RESET, NO EMAIL, NO LOCKOUT, NO ROTATION, NO OIDC** (§0.2 item 2). ⚠️ **A1 is
  adequate for two people and 🚫 NOT for ten** — the owner accepted that limit when they accepted
  the shape, and 🚫 the token model must not be built "so it can grow later".

⚠️ **The one honest word for this is "login", and the ADR uses it rather than a euphemism.** A human
types something and gets a session; calling it "token presentation" would be the architecture
describing itself more favourably than it behaves.

### D4 — 🚫 NO PROVISIONING SURFACE. ADR-0068 §0.1c item 1 is **NOT** reversed.

🛑 **This is the fence that stays up, and it is the one most likely to be knocked down by
convenience** — because the moment a second Agency Admin is wanted, a form is one afternoon away.

- 🚫 **No account-creation route, no CLI subcommand, no seeding script, no "just for the first one"
  helper, no admin screen that writes an operator row.**
- ⚠️ Each operator account is **an event with a date**: the developer inserts one row, deliberately,
  once. 🚫 A provisioning code path is a **write surface** (ADR-0057 D4) and was refused by name.
- ⚠️ **A guard must assert this**, and 🚫 it must be made to fail before it counts (§6 item 7).

### D5 — The client switcher is a FILTER over an entitlement that was decided without it

🛑 **THE ORDER IS THE ARGUMENT, and it is the same order ADR-0068 §3 made the owner's:**

> `principal → entitlement → scope → allowed operation → data`

🚫 and **never** `caller → clientId → database`.

The switcher, stated as steps so each can be pointed at in a diff:

1. **The session establishes the organization.** ⚠️ From the ROW, 🚫 never from the cookie, 🚫 never
   from a header, 🚫 never from the URL.
2. **The list of selectable clients is derived from the client registry, filtered to that
   organization.** ⚠️ `ClientRecord` **already carries `organizationId`** — the binding exists and
   🚫 does not need inventing. 🛑 **The menu is a projection of what the session may already read**,
   so a client that appears in the switcher is one whose workspace the boundary will then admit.
   ⚠️ **RankOps names the failure mode this avoids: _"a menu of empty rooms"_** — a switcher offering
   a client the read path then refuses.
3. **A selection is a `clientId`, and it is UNTRUSTED INPUT — two strings, nothing more.** 🚫 It
   establishes nothing. ⚠️ It is resolved to an organization **server-side, from the registry**, on
   **every** request; 🚫 never cached in the cookie, 🚫 never taken on the client's word.
4. **`readWithinEntitlement` is then asked about the ORGANIZATION** (ADR-0062 D1) and 🚫 never about
   the client. ⚠️ The `client` arm of `EntitlementSubject` stays `not-established` inside the
   decision, **where it belongs** — 🚫 asking it instead would be a working check that refuses
   everything, which reads as a boundary and is not one.
5. **A selection the session is not entitled to is REFUSED, identically to one that does not
   exist.** 🛑 **One refusal text, declared once.** ⚠️ Distinct texts would turn the switcher into
   an **existence oracle** for every other organization's clients — RankOps' `SELECTION_REFUSAL`
   makes exactly this point, and 🚫 a friendlier "no such client / not yours" split is the mistake.
6. 🛑 **A DENIAL IS RAISED, 🚫 NEVER RETURNED AS AN EMPTY LIST** (ADR-0068 §0.1d). ⚠️ An empty
   result set is indistinguishable from a business with no data, and 🚫 it is not a proof.

🚫 **THERE IS NO "CURRENT CLIENT" IN SHARED STATE THAT A PAGE MAY TRUST** (ADR-0058 D4's reasoning,
which is 🚫 not repealed): a level you can select is a **typed scope**, and ADR-0054 D2 refuses one.
⚠️ What is permitted is a selection that is **re-decided from the session on every request**, which
is the opposite of a scope somebody typed.

### D6 — "Agency Admin" is a description, 🚫 not a role column

⚠️ The owner's model names three levels — Super Admin → Agency Admin → Client — and ADR-0062 D2/D3
froze it. 🛑 **In V1 only the middle one is built**, and it is built as **an operator whose session
establishes exactly one organization**, which is what an Agency Admin _is_.

- 🚫 **No `role`, `isAdmin` or permission list on a session** (ADR-0062 D3): _"admin is never a
  bypass, and a flag on a session is how a bypass arrives."_
- 🚫 **The Super Admin (cross-organization reach, ADR-0062 D3) is NOT built here**, and 🚫 no arm,
  column, union member or "for later" hook for one may be added. ⚠️ It is the single most dangerous
  role in the product; it gets its **own** ADR, with the audit question (§6.3 of ADR-0062) answered
  in it. 🚫 Naming it in the UI as "coming soon" is also refused.
- 🚫 **Client login is not built and not prepared for** (§0.1, ADR-0062 D2).

### D7 — Every protected read verifies entitlement independently

⚠️ The owner's words: _"Every protected route/API/read must independently verify the operator's
entitlement to that client."_ 🚫 Not a middleware that stamps a request object other code then
trusts.

- ✅ Each `/b/[clientId]/*` server action goes through `readWithinEntitlement`. ⚠️ It already runs
  **both** checks — the entitlement decision **and** `acceptSessionScopedClientContext`, which
  **rebuilds the context from the session** so what reaches the query cannot be a caller-held object
  mutated after the decision. 🚫 Deleting either must fail a test.
- 🛑 **A NEW ROUTE MUST BE UNAUTHORIZED BY DEFAULT, 🚫 NOT BY REMEMBERING.** ⚠️ A guard enumerates
  the routes and fails the build when one appears unclassified — the shape RankOps uses for
  `ACTOR_ONLY_CONTROLLERS` (_"a NEW controller fails the suite until it is classified"_). 🚫 An
  allowlist somebody has to extend is right every time only until it isn't.
- ⚠️ **The read-only rule is structural, 🚫 not a list.** V1 is read/browse/inspect; the boundary
  should exclude a future write route **on the day it is added**, not on the day somebody
  remembers. ⚠️ RankOps achieves this with a transport rule (GET only) rather than a handler
  allowlist, and 🚫 the reason is stated there: _"An explicit allowlist would have to be right every
  time; this is right by default."_

### D8 — The deployed store: AGE's own database and role on the VPS's Postgres

⚠️ **This decides nothing ADR-0061 A5 had not already decided** — it is recorded so the deployment
is judged against a written shape. A5's consequence stands and is 🚫 not softened: 🛑 **a real
client's data will live on a server the operator does not physically hold.**

- ✅ **`selectDeployedDatabaseComposition` is the entry point**, with its written-in-source
  acknowledgement. 🚫 It cannot be selected by an environment variable alone, and 🚫 no
  `allowRemote` flag or quietly-permitting second function may appear.
- ✅ **A separate database and a separate role**, on the Postgres already running on the VPS
  (§0.2 item 3). 🚫 AGE's role has no reach into RankOps' database, and 🚫 vice versa.
- ✅ **`DATABASE_URL_APP` addresses `127.0.0.1`**, is delivered by `@age/deployment-secrets` from an
  environment file, is 🚫 never committed, and 🛑 **absent at startup is a REFUSAL, never a default**
  (A6 item 2).
- ✅ The existing migrations run against it — `scored_bif_snapshots` (+ RLS), `operator_sessions`
  (+ RLS), `source_observations`. 🚫 No new table is authorized by this ADR. ⚠️ In particular
  ADR-0067's question is separate and answered separately.
- ⚠️ **`assertLocalDatabaseTarget` KEEPS ITS TEETH on `apps/capture`'s local path**, which is 🚫 not
  deleted, 🚫 not relaxed and 🚫 not this code path. ⚠️ Its named evasion still stands: **an SSH
  tunnel from `localhost:5432` to a shared server _is_ loopback and is still forbidden.**
- 🚫 **Where a row may be stored is 🚫 not who may read it.** D8 is not an authorization.

### D9 — TLS terminates in front of the app, and the vhost lands with the boundary, 🚫 never before it

- ✅ `age.digitaldadi.agency`, TLS terminated by nginx, proxying to the console on loopback.
  ⚠️ Modelled on the RankOps vhost already on the box **so an operator reads one shape, not four** —
  including its two hard-won notes: `.well-known/acme-challenge/` stays **above** the redirect so
  certbot renews with Cloudflare's orange cloud on, and `real_ip_header X-Forwarded-For` is
  **overwritten rather than appended** so a client cannot inject its own value into the rate
  limiter.
- 🛑 **THE VHOST AND THE AUTH BOUNDARY SHIP IN THE SAME SLICE, AND THE VHOST IS LAST.** 🚫 A vhost
  in front of an unauthenticated console — even briefly, even "just to test DNS" — is the crossing
  ADR-0057 D2 and `deploy-studio.sh` both refuse by name. ⚠️ **There is no window in which it is
  acceptable**, because the exposure is permanent from the first request.
- ⚠️ **The SSH tunnel remains as an engineering fallback** (the owner's own allowance) and 🚫 is no
  longer described anywhere as the login experience. 🛑 `deploy-studio.sh`'s closing text currently
  says _"The tunnel is the authentication"_ — ⚠️ **that sentence must be corrected in the slice that
  makes it false**, because a screen or a script claiming a blocker the architecture has since
  removed is as dishonest as one claiming a capability that does not exist.

---

## 5. What this ADR authorizes — and what it still does not

⚠️ Written now so a future acceptance cannot be read more broadly than it was given.

✅ **Authorized, if accepted:** a public deployment of `apps/studio` behind TLS · a token-verification
route that sets the session cookie · session verification composed in front of every route · a
client switcher that filters · `readWithinEntitlement` as the caller on every protected read · AGE's
own database and role on the VPS · the nginx vhost for `age.digitaldadi.agency` · and the six A6
items, **each made to fail** (§6).

🚫 **NOT authorized, and each refused independently:** Business Execution (ADR-0057 D4 class 3 —
refused, not postponed) · **any provisioning surface** (D4) · **the Super Admin** (D6) · **client /
business-owner login of any kind** (§2) · any model call inside AGE (ADR-0060 D7) · committing real
client records (ADR-0053 D3) · promoting a BIF status · treating RLS as authorization · a new table
(D8) · a login on the hosted demo (ADR-0061 §5-D) · **a second authentication model** — 🛑 there is
one credential path, and A1 is it.

## 6. The gate — ADR-0061 A6, plus what this ADR adds

🛑 **EACH ITEM MUST BE SHIPPED AND MADE TO FAIL BEFORE A SECOND HUMAN IS GIVEN A URL.**
⚠️ _"Recorded" is not "addressed": an item ticked without a failing-then-passing test is not
discharged._ ⚠️ **A guard is evidence only once it has been made to fail** — mutate the thing it
protects, confirm the guard names the mutation, restore. 🔴 **Restore with a targeted inverse edit,
🚫 NEVER `git checkout <file>`.**

| #   | A6 item                     | What exists on `main`                               | What the slice must add                                                              |
| --- | --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | **Transport**               | `@age/deployed-origin`                              | The vhost; 🚫 no plaintext origin publicly reachable                                 |
| 2   | **Secrets**                 | `@age/deployment-secrets`                           | Wiring; 🛑 absent at startup is a **refusal**                                        |
| 3   | **Session cookies**         | `@age/session-cookie` (`__Host-`, Secure, SameSite) | Issuance on verify; **`revokedAt` proven to refuse a live cookie**                   |
| 4   | **Rate limiting**           | `@age/auth-rate-limit`                              | Applied to the verify route specifically                                             |
| 5   | **Tenant isolation TESTED** | `@age/entitled-read`, `@age/tenant-isolation`       | 🛑 **A real `denied`, raised BEFORE a query exists** — 🚫 not written against RLS    |
| 6   | **Audit**                   | 🚫 nothing                                          | Who verified, and what was read, retrievable. 🚫 Refusals name no identifier         |
| 7   | **No provisioning** (D4)    | 🚫 nothing                                          | A guard asserting no account-creation path exists, **made to fail**                  |
| 8   | **AGE-INV-SEL-1** (§3)      | 🚫 nothing                                          | A test proving a selection **narrows**: forged `clientId` = no-op, 🚫 not escalation |
| 9   | **OX-INV-1b** (D2)          | The old D2 guard (scans manifests only)             | A guard that also scans **source**, and cannot express "public + unauthenticated"    |

⚠️ **Item 5 is ADR-0068 §0.1d's criterion and is the one that decides whether slice 7 shipped at
all:** _"Operator 2 is not just another login screen. It is the first real proof that ADR-0055's
entitlement problem has actually been solved."_ 🚫 A working login with no real `denied` has not
shipped it.

## 7. Sequencing — 🚫 the order is not negotiable

⚠️ ADR-0061 §4: _"Deploying first and adding identity after is the failure mode this ADR is written
to make visible — at that point the exposure is already permanent."_

1. **The database on the VPS** (D8) — 🚫 nothing public, 🚫 nothing exposed. Reversible.
2. **Session verification composed in front of every route, still on loopback** (D3, D7) — the
   console gains a door while it is still behind the tunnel. 🛑 The A6 gate is discharged here.
3. **The switcher** (D5) + AGE-INV-SEL-1's test (§6 item 8).
4. **The public bind and the vhost, LAST and together** (D2, D9) — and 🚫 only once 1–3 are green.

⚠️ **Item 2 is where the owner's proof lives, and it is reachable without ever exposing anything.**
🚫 Do not reorder to get a URL sooner.

## 8. Open questions this ADR does NOT answer

1. **The Super Admin** — cross-organization reach (ADR-0062 D3), and 🛑 the audit question ADR-0062
   §6.3 raised and nobody has answered: _"Who creates an admin, and what audits one?"_ Its own ADR.
2. **The tenth operator.** 🚫 A1 does not scale and was accepted knowing it. The move to A2 or A3 is
   a new ADR, and 🚫 A1 must not be built to accommodate it in advance.
3. **What a client would see, if a client ever logs in** (ADR-0062 §6.2). 🛑 Unanswered, and it is a
   **product** decision, not an access-control one — a BIF carries the agency's assessment of that
   business, including low scores.
4. **Where the operator's files live when deployed** — ADR-0061 A4 decided the workspace root is
   derived from the **authenticated organization** and 🚫 never from a request parameter.
   ⚠️ `deploy-studio.sh` currently names one workspace path for the whole host, which A4 does not
   permit once there is more than one organization. 🚫 Out of scope here; it binds the slice that
   adds a second organization, 🚫 not a second operator in the same one.
