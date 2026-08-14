# ADR-0068 slice 7 — session handover checkpoint

> **Written 2026-08-11**, after **#298**. `main` HEAD **`9d6519a`**.
> Track: the second operator — an entitlement caller, session rows, and a token AGE never issues.
> ⚠️ This is the per-track record. State and standing rules stay in `CLAUDE.md` §1;
> the durable half lives in `docs/AGE_STANDING_CONTEXT.md`.

---

## 1. What authorized this track, and how far the authorization reaches

**ADR-0068 is `Accepted` (#295), 🚫 not self-accepted.** The Product Owner's answer arrived as a
**selection** from the shapes the ADR offered — recorded as such in §0.1 — and 🚫 **the owner
picking the architect's own recommendation is not independent corroboration** (finding 7).

The decision is **A1**: an operator-provisioned token, hashed at rest, with an **absolute expiry**;
and **provisioning is an act**, 🚫 not a feature.

**§0.1b lowered exactly three things, and nothing beside them:**

| #   | Lowered                                                                 | State                |
| --- | ----------------------------------------------------------------------- | -------------------- |
| 1   | The **session-store rows** — model, migration, RLS, **that store only** | ✅ shipped, **#298** |
| 2   | **`askEntitlement`'s first real caller**, on a READ path                | ✅ shipped, **#297** |
| 3   | **Verification of a presented token**                                   | 🛑 **still owed**    |

**§0.1c still refuses, BY NAME:** any provisioning surface (route, CLI subcommand, seeding script,
"just for the first one" helper) · login route / screen / sign-in / session issuance ·
second-operator UI · operator switcher · password / reset / lockout / rotation · OIDC ·
**business-owner anything**.

⚠️ **A1 is adequate for two people and 🚫 NOT for ten.** A tenth operator is a **new ADR**, and 🚫 the
token must not be built "so it can grow" — _"future compatible"_ is the **named failure mode**.

🚫 **ADR-0055 D7 stays undischarged.** This is a read path, not a capture write.

---

## 2. #297 — the caller (merge `3494362`, CI 31425271890, 15 steps)

`@age/entitled-read` — `readWithinEntitlement` asks `askEntitlement` on the **organization**
subject, raises `EntitlementRefusedError` on anything but `granted`, and **only then** rebuilds the
context via `acceptSessionScopedClientContext` and calls the **injected** query.

- 🛑 **The proof is the ORDER, and it is structural.** `openQuery` is a **parameter that throws if
  called** — 🚫 not a counter inspected afterwards. A refusal raised too late fails loudly instead
  of looking identical to one raised in time. That is ADR-0068 §0.1d's acceptance criterion,
  delivered as a shape rather than an assertion.
- 🚫 **A denial RAISES; it never returns `[]`.** An empty result set is indistinguishable from a
  tenant that has no rows (ADR-0068 §4).
- ⚠️ The error **carries the answer**, so `denied` and `not-established` stay distinguishable
  (ADR-0058 D2). 🚫 `not-established` is never a shy `denied`.
- ⚠️ **Both checks run and neither is the other** — entitlement answers "may this session act on
  this organization"; tenant isolation answers a different question, and each was proved by mutation
  (10 failures for reordering, 3 for dropping isolation).
- ⚠️ **`packages/entitlement/src/tests/guards.spec.ts` was CHANGED DELIBERATELY, citing ADR-0068
  §0.1b — 🚫 NOT DELETED.** _"called by nothing"_ became **exactly one caller, in the named file**,
  following the precedent already recorded in that file for the A2/A4/A6 slices.

---

## 3. #298 — the rows (merge `9d6519a`, CI 31428116481 · 15 steps; live DB 31428116504 · 18 steps)

`OperatorSession` → `operator_sessions`: model, migration `20260811000000_operator_sessions`, RLS,
a repo-suite schema guard, a live PostgreSQL suite, and `normalizeSessionRecord` in
`@age/session-store`.

### 3.1 🛑 `GRANT SELECT` and nothing else

No INSERT, UPDATE, DELETE, TRUNCATE or REFERENCES; nothing to PUBLIC; **exactly one policy,
`FOR SELECT`, with no `WITH CHECK`**.

That is how 🛑 **VERIFICATION IS NOT ISSUANCE** holds **by shape rather than by promise**: the second
operator's row is planted **as an ACT** on an owner connection, so the provisioning function someone
adds later fails **at the database**, not at a code review. There is deliberately **no INSERT
policy** either — a policy that permits nothing is indistinguishable from one that was forgotten,
and the absent GRANT is the honest statement.

### 3.2 What the row deliberately does not carry

- 🚫 No `role`, `isAdmin`, `permission`, `scopes` or `claims` (ADR-0062 D3) — **admin is never a
  bypass**, and a column is how a bypass arrives: the check that reads it is added later, by someone
  who did not read the ADR.
- 🚫 **No raw token.** `token_hash` is a SHA-256 digest and **UNIQUE**, so one presented token
  matches at most one session.
- 🚫 **No `DEFAULT`, no `now()`, no `@default`, no `@updatedAt`.** A row that timestamps itself is a
  fact the database invented.
- 🛑 **`expires_at` is NOT NULL** — 🚫 there is no "never expires". `revoked_at` is a **nullable
  column**, 🚫 never a deleted row.
- ⚠️ The boundary is the **ORGANIZATION ALONE** (ADR-0062 D1/D2 — a session belongs to no client);
  🚫 `client_id` appears nowhere in the migration.
- Fails closed: `NULLIF(current_setting('age.organization_id', true), '')`, so a transaction that
  forgot to scope itself sees **no** sessions rather than all of them, and 🚫 two absences never
  agree.

### 3.3 A stored row is untrusted input

`normalizeSessionRecord` re-validates one on the way out and **refuses rather than repairs**. 🚫 It
defaults, generates and infers **nothing**: a missing expiry never becomes "no expiry"; an absent
`revokedAt` key never becomes "never revoked" (⚠️ `undefined` is refused, not read as "live"). Both
absences would read as permission. A refusal names a **POSITION** — 🚫 never the tenant, the account
or the digest (ADR-0054 D3). `@age/session-store` still performs **no effect**; its own purity
guards passed unchanged.

### 3.4 What the live suite proves — and what it does not

- ⚠️ **Every assertion runs as the non-owner, non-superuser, `NOBYPASSRLS` role**, and the suite
  **asserts those three attributes itself** rather than trusting the workflow that set them. The
  owner connection is used only to plant fixtures and truncate.
- 🚫 **No assertion rests on an empty result set.** Each "cannot see" is paired with a count the
  **OWNER** can still take, so a table that was merely empty fails the test.
- ⚠️ **RLS is coherence, 🚫 NEVER authorization** (ADR-0046 D5). It keeps a scoped transaction inside
  its scope; it does not decide who may read. 🚫 The isolation this track claims is never proven by
  RLS, and never by emptiness.
- The **schema guard runs in the ordinary suite**, because the facts it pins — no `DEFAULT now()`,
  no `isAdmin`, no INSERT grant — are ones a later migration could quietly reverse between live runs.

### 3.5 Evidence discipline

- **Both guards were made to fail.** `GRANT SELECT` → `GRANT SELECT, INSERT`: **2 red**. Dropping
  `NULLIF` from the policy: **1 red**. Both restored by **targeted inverse edits** — 🔴 never
  `git checkout <file>` (the #281 lesson).
- `prisma migrate diff --from-empty` output is **byte-identical** to the committed migration, and
  CI's drift check confirmed it against a real database.
- Post-merge runs matched by **full `head_sha`**, with step counts (15 / 18) — 🚫 never "the newest
  success", 🚫 never a 0-step job.

---

## 4. 🚫 NOT BUILT — and each is refused, not merely unstarted

Token verification · minting · a login route, screen or cookie · session issuance · a provisioning
path of any kind · an operator switcher · middleware · business-owner anything. The guards in
`@age/entitled-read` scan for most of these **by name**.

---

## 5. 🛠️ What slice 7 still owes — and only this

1. 🛑 **Verification of a presented token.** Hash the presented token, read the row through the
   organization-scoped path, and decide with `assessSession` against a **caller-supplied** clock
   (the package has no clock, on purpose). 🛑 **VERIFICATION IS NOT ISSUANCE:** 🚫 no minting, no
   `Set-Cookie`, no login route, no session endpoint. The store grants AGE `SELECT` only, so the
   shape already refuses the alternative.
2. 🛑 **An Operator 2 account, PROVISIONED AS AN ACT** — one row, planted by a human on an owner
   connection, once. 🚫 Never a provisioning route, CLI subcommand, seeding script or "just for the
   first one" helper (§0.1c).

⚠️ Isolation is proven by a real `denied` raised **before a query exists** — 🚫 never by an empty
result set, and 🚫 never by RLS.

---

## 6. Beyond this track — still owed, 🚫 not started

Each needs its own `Proposed` ADR, read in its own words:

- **D4.2 — the decoder ADR** (PDF/DOCX). 🚫 **NOT discharged by "plain text first."**
- **D4.3** — website URL ingestion: SSRF and an allow-list.
- **D5** — the model call.

🚫 **ADR-0067 authorizes nothing.** A draft answer lives **nowhere** between requests, and that is a
**decision, 🚫 not a gap** — 🚫 do not "fix" it with a file write, a cache, a module-level variable,
a session field or a hidden form value. Revisiting needs a **real operator hitting the limit on a
real document**, 🚫 not a prediction.

---

## 7. Pointers

| Thing                                 | Where                                                    |
| ------------------------------------- | -------------------------------------------------------- |
| Current state, tripwires, next action | `CLAUDE.md` §1 (untracked)                               |
| The durable half of §1, verbatim      | `docs/AGE_STANDING_CONTEXT.md` (untracked)               |
| The #287–#294 blocks, verbatim        | `docs/AGE_STANDING_CONTEXT.md` §12az                     |
| Shipped refusals (twelve blocks)      | `docs/reviews/AGE_SHIPPED_REFUSALS.md`                   |
| Architecture on `main`                | `docs/reviews/AGE_ARCHITECTURE_ON_MAIN.md`               |
| Architect findings (append only)      | `docs/reviews/AGE_ARCHITECT_FINDINGS.md`                 |
| The snapshot-read track               | `docs/reviews/ADR0055_SNAPSHOT_READ_TRACK_CHECKPOINT.md` |

## §4 — #302, part three: verification of a presented token (EXTRACTED VERBATIM from CLAUDE.md §1, 2026-08-13)

> ✅ **#302 — SLICE 7 PART THREE SHIPPED: VERIFICATION OF A PRESENTED TOKEN.**
> `packages/session-store/src/session-verification.ts` — `verifyPresentedSessionToken`.
> 🛑 **VERIFICATION IS NOT ISSUANCE, AND IT HOLDS BY SHAPE**: mints nothing, writes nothing,
> provisions nobody; the store behind it holds `GRANT SELECT` only, so there is no INSERT to reach
> for. ⚠️ **`findRowByTokenHash` IS A PARAMETER SO THE ORDER CAN BE PROVEN** — six malformed tokens
> are refused while a lookup that THROWS IF CALLED stays untouched; the lookup receives the
> **DIGEST**, 🚫 never the credential. 🚫 **THE FIVE FAILURES STAY FIVE** — `malformed-token` ·
> `no-such-session` · `revoked` · `expired` · `unreadable`; 🚫 never collapsed into "invalid", and
> 🚫 an ordinary failure NEVER THROWS (an unverified token is an ANSWER). ⚠️ Revocation before
> expiry is preserved by delegating to `assessSession`, 🚫 not re-deciding it. 🚫 A row the
> normalizer refuses is `unreadable`, never `no-such-session`; 🚫 a MISSING `revokedAt` key is
> `unreadable`, never "never revoked". 🚫 **NOTHING HERE IS AN AUTHORIZATION** — it says WHO, and
> `askEntitlement` always follows. Both guards were made to fail by name (7, then 2) and restored
> with targeted inverse edits.

## §5 — #322, part four: the read behind a presented token (2026-08-14)

> ✅ **#322 — SLICE 7 PART FOUR SHIPPED: `@age/session-store-persistence`, THE DURABLE READ BEHIND
> `verifyPresentedSessionToken`** (main `8edba2b`, CI green **15 steps**, CI (live database) green
> **18 steps**, the new live spec ran — 5 tests inside 85). ⚠️ **ADR-0068 §0.1b LOWERED EXACTLY
> THREE THINGS AND ALL THREE ARE NOW SHIPPED**: #297 the entitlement question's first real caller,
> #298 the rows, #302 the pure verifier — and this, the adapter that lets the verifier reach a real
> row. 🚫 Before it, `verifyPresentedSessionToken` had **ZERO CALLERS AND NO WAY TO GET ONE**.
>
> 🛑 **VERIFICATION IS NOT ISSUANCE, HELD BY SHAPE TWICE OVER.** `OperatorSessionDelegate` declares
> **`findUnique` AND NOTHING ELSE** — 🚫 no `create`, `createMany`, `update`, `updateMany`,
> `upsert`, `delete`, `deleteMany` — matching `GRANT SELECT` and the `FOR SELECT` policy with
> 🚫 **no `WITH CHECK`**: a write fails at the database **and** cannot be expressed in the type.
> 🚫 **THERE IS NO `findMany` EITHER** — listing sessions is the second-operator UI §0.1c refuses
> by name. ⚠️ Widening that interface **is** the issuance path, and it needs its own ADR.
>
> 🛑 **THE SCOPE IS REQUIRED, AND THAT IS A FINDING, 🚫 NOT AN INCONVENIENCE.**
> `operator_sessions_select_in_scope` fails closed, so a verification that ran **UNSCOPED** would
> return no row and be reported as `no-such-session` — 🚫 **A FALSE REFUSAL INDISTINGUISHABLE FROM A
> BAD CREDENTIAL.** So `operatorSessionLookup` takes the organization, and 🚫 **IT IS NEVER
> DEFAULTED**: there is no "all organizations" value and no fallback.
> 🛑 **THE CLAIM NARROWS AND NEVER WIDENS** — naming a tenant cannot reach that tenant's sessions,
> because the digest must still match a row **already inside** the named scope; and a verified
> session carries its **OWN** `organizationId`, which is what `@age/entitled-read` re-derives a
> query scope from (ADR-0062 D1), 🚫 never the caller's claim.
>
> 🛑 **THE LOOKUP REACHES NO CONCLUSION.** It receives a **DIGEST AND NEVER THE TOKEN** — the
> package has 🚫 no `node:crypto`, so it **cannot** be handed one even by a caller trying to. It
> hands the row back **RAW** (`unknown`) so `normalizeSessionRecord` re-validates it as untrusted
> input, and 🚫 `null` travels as `null` — collapsing it here would destroy the
> `no-such-session` / `revoked` distinction **before it is made**. ⚠️ A guard pins that hashing,
> expiry, revocation and row validation are 🚫 **NOT NAMEABLE** in this package: exactly one
> implementation each, elsewhere.
>
> ⚠️ **LIVE PROOF, AS THE NON-OWNER `NOBYPASSRLS` ROLE, 🚫 NO ASSERTION ON AN EMPTY RESULT SET**
> (`packages/persistence/src/tests/operator-session-verification.db.spec.ts`): a planted live row
> verifies and yields **THE FIRST CONSTRUCTIBLE AUTHENTICATED PRINCIPAL IN THIS REPOSITORY**; a
> never-minted token, and a caller naming another tenant, are each `no-such-session` **while the
> OWNER STILL COUNTS THE ROW**; `revoked` and `expired` stay apart across the real store.
> 🛑 **EVERY ROW IS PLANTED BY THE OWNER CONNECTION** — the app role holds `SELECT` and nothing
> else, so the fixture _is_ the ACT, 🚫 not a code path.
>
> ⚠️ **THE ORDER IS PROVEN, 🚫 NOT ASSERTED**: the scope is applied **before** the read, by recorded
> call order, and the organization travels as a **BOUND PARAMETER** (`$executeRaw` tagged-template;
> 🚫 `$executeRawUnsafe` is absent). ⚠️ **TWO GUARDS MADE TO FAIL AND RESTORED BY TARGETED INVERSE
> EDITS** (🚫 never `git checkout`): adding `create` to the delegate — _"offers no create anywhere in
> the package"_ named it; reading before `set_config` — the order test named it.
>
> 🛑 **STILL NOT WIRED TO ANY SURFACE, ON PURPOSE.** ADR-0069 deliverable 7's MCP half remains
> unbuilt: it needs a decision about **WHERE A TOKEN IS PRESENTED** (the transport), which is its
> own slice and 🚫 must not arrive as a middleware. 🚫 **ADR-0055 D7 STAYS UNDISCHARGED.**
> 🛠️ **SLICE 7 STILL OWES THE OPERATOR 2 ACCOUNT, PROVISIONED AS AN ACT** — 🚫 never a provisioning
> code path (§0.1c). 🚫 Isolation is never proven by an empty result set, nor by RLS (coherence,
> ADR-0046 D5).
