# RankOps ↔ AGE — the access model, compared before any code is written

**ADR-0074 §0.3 required this, and required it BEFORE code:** _"Before writing code, inspect RankOps
and AGE and produce a short comparison: how RankOps authenticates · how it establishes the
agency/organization · how it implements the client switcher · how client isolation is enforced ·
which parts can safely be reused conceptually in AGE · what AGE must implement differently because
of its existing ADRs."_

⚠️ **The last question is the one this document exists for.** _"Reuse the proven model"_ instructions
usually lose that half, and the answer here turns out to be large: **AGE is not a smaller RankOps
with fewer features — it disagrees with RankOps about what authorization IS**, and three of the
disagreements are recorded ADRs. 🚫 Copying the parts that look transferable would import decisions
AGE has already refused.

⚠️ Read against the repositories, 2026-08-15. RankOps at `apps/backend/src/{auth,tenancy}`; AGE at
`packages/{entitlement,entitled-read,session-store,session-store-persistence,session-cookie,auth-rate-limit,tenant-isolation}`
and `apps/studio`.

---

## 1. The headline

🛑 **THE SINGLE MOST IMPORTANT FINDING: AGE ALREADY HAS ALL OF IT, AND CALLS NONE OF IT.**

```
grep -r 'readWithinEntitlement|@age/session-cookie|@age/entitled-read|VerifiedSession' apps/
→ zero matches
```

⚠️ So the honest description of this work is **wiring an existing boundary into an existing console**,
🚫 not building an authentication system. That matters for how it is judged: the risk is 🚫 not
"will the crypto be right" — it is **"will the boundary be composed in front of every path, including
the ones added next month."**

⚠️ **What AGE is missing is genuinely small and genuinely three things:** a **login route**, a
**switcher**, and **an audit record** (A6 item 6, the only gate item with nothing behind it).
Everything else exists, tested, and unused.

---

## 2. How RankOps authenticates

|                   |                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Credential**    | Email + password, and Google OAuth. `AuthService` verifies; `argon2`/bcrypt at the credential layer.           |
| **Token**         | **JWT pair** — a 15-minute access token and a 7-day refresh token, `{ sub, email, role }`.                     |
| **Transport**     | `Authorization: Bearer` (`ExtractJwt.fromAuthHeaderAsBearerToken()`).                                          |
| **Per-request**   | `JwtStrategy.validate` re-reads the **user row from the database on every request** and returns the live user. |
| **Issuance**      | One point: `AuthTokenService.issue`.                                                                           |
| **Rate limiting** | `auth-throttle.ts` + named throttlers, with a contract test.                                                   |

⚠️ **Two RankOps decisions are worth naming because they are scars, and AGE benefits from both
without inheriting the wound:**

1. **Separate signing keys per token type, plus a `type: "refresh"` claim.** Before the split, both
   tokens were signed with the same secret and carried the same payload — so **a refresh token was a
   valid bearer token for every authenticated route: a 7-day credential where the design intended
   15 minutes.** The claim check is retained even though it is now unreachable, deliberately: it
   protects tokens issued before the key split.
2. **`validate` re-reads the user row every request.** ⚠️ This is what makes `role` non-forgeable —
   the token's `role` claim is 🚫 **never trusted**. It is also RankOps' only mitigation for the
   structural problem below.

🛑 **THE STRUCTURAL LIMIT, STATED PLAINLY: A RANKOPS ACCESS TOKEN IS A BEARER CREDENTIAL AND CANNOT
BE REVOKED.** Revoking means deleting or disabling the user row; there is no per-session record. A
stolen access token is valid until it expires, whatever anyone decides in the meantime.

⚠️ **AGE ALREADY REFUSED THIS SHAPE**, in `session-record.ts`, in ADR-0061 A2's words: sessions are
**rows the server can revoke**, 🚫 _"never a bearer token the client holds and replays past
revocation"_ — because with a self-contained token _"log this person out becomes a wish."_
🛑 **This is the first place where copying RankOps would be a regression**, and it is precisely the
mechanism the owner's own **logout / session expiry** requirement depends on.

---

## 3. How RankOps establishes the agency / organization

⚠️ **It does not carry one on the credential.** There is no `organisationId` in the JWT payload. The
organization is derived, per request, from **membership rows**:

```ts
// site-access-scope.ts — tenantAccessWhere
workspace: {
  OR: [
    { memberships: { some: { userId } } }, // the CLIENT's claim
    { organisation: { memberships: { some: { userId } } } }, // the AGENCY ADMIN's claim
  ];
}
```

⚠️ **The agency-admin branch is a TRAVERSAL, not a copied list of workspace ids**, and RankOps says
why: _"a workspace created AFTER the grant is covered without re-granting anything."_ ✅ **A good
decision, and AGE should hold the same property** — a client record added tomorrow must not need a
grant edited today.

⚠️ **The widening is additive and ordered:** `legacyOwnerWhere` (the pre-tenancy `Site.userId`
predicate) is consulted FIRST and stays first, with a stated reason: _"never reorder it behind an
id-only lookup: querying by id and then comparing owners discloses that the site exists."_
🚫 **AGE has no legacy-ownership predicate and must not grow one** — it would be a second authorization
mechanism, which is the thing the owner refused by name.

🛑 **AND THERE IS NO PLATFORM-WIDE BRANCH, ON PURPOSE:** _"Adding `super_admin` here would make every
read in the application implicitly platform-wide and would silently defeat that ADR."_ ⚠️ **That is
exactly ADR-0062 D3 and ADR-0074 D6, reached independently in the other repository** — and it is the
strongest available argument that AGE's refusal to build the Super Admin now is 🚫 not timidity.

---

## 4. How RankOps implements the client switcher

`tenancy/tenant-selection.ts`, Package 73. **The rule, in its own words: _"a selection is a FILTER,
never a grant."_**

```ts
export function applySelection(readable, selectedWorkspaceId) {
  if (selectedWorkspaceId === null) return readable;
  return { AND: [readable, { workspaceId: selectedWorkspaceId }] }; // ⚠️ AND, one-directional
}
export function resolveSelection(requestedWorkspaceId, entitled) {
  if (!requestedWorkspaceId) return null;
  if (!entitled) throw new ForbiddenException(SELECTION_REFUSAL);
  return requestedWorkspaceId;
}
```

Five properties, each deliberate and each worth carrying:

1. 🛑 **The composition is an `AND`, so the answer is always a SUBSET of what the caller could already
   read.** _"A forged header would then be an escalation instead of a no-op"_ if this ever inverted.
2. ⚠️ **`entitled` is asked of the database ON THIS REQUEST** — 🚫 never cached in the token, 🚫 never
   taken on the client's word.
3. 🛑 **ONE refusal text.** `SELECTION_REFUSAL = "No such client."` — a workspace you may not reach is
   answered **identically** to one that does not exist, because _"distinct texts here would turn the
   switcher into an existence oracle for every other agency's clients."_
4. ⚠️ **The uuid SHAPE is checked beside the refusal, 🚫 not at the route.** A malformed id crashed
   Prisma into a 500 — _"two things at once: a crash on attacker-controlled input, and an oracle
   distinguishing 'malformed' from 'not yours'."_ ⚠️ Checked there rather than in a pipe because a
   pipe _"would have to be remembered again by the next route that honours a selection."_
5. ⚠️ **The menu and the boundary use the SAME two branches**, or the switcher offers _"a menu of empty
   rooms"_ — a client it then refuses.

⚠️ **The transport is a header** so a selection need not become a URL segment every route grows.
🚫 **AGE will differ here** (§8.4): its clientId is **already in the route** (`/b/[clientId]/*`).

🛑 **AND RANKOPS NAMES ITS OWN DEBT, WHICH AGE MUST NOT INHERIT.** Package 70's super-admin client
context grants **implicitly**: _"A super_admin may name any non-super_admin user; no row records why,
and there is nothing to revoke."_ ⚠️ AGE's entitlement is a **session row naming an organization**,
which is revocable — 🚫 do not import the implicit shape along with the good one.

---

## 5. How RankOps enforces client isolation

- `scopedWhere` **injects** the tenant field and 🛑 **throws if the caller set it**: _"Scoped query
  must not set `workspaceId` directly; it is injected from the tenant context."_
- `TenantContext` is **frozen**, and `authenticatedUserId` MUST come from the trusted auth result —
  🚫 _"controllers MUST NEVER populate it from body/query/headers."_
- `tenant-context.resolver.ts` runs **six sequential checks, all failing with one opaque error**
  (`"Requested tenant scope could not be resolved"`).
- Read-only super-admin context is enforced **structurally, by HTTP method** — `resolveTenantUserId`
  returns the client id **only on GET**. ⚠️ Deliberately a transport rule and 🚫 not a handler
  allowlist: _"a NEW write route is excluded on the day it is added. An explicit allowlist would have
  to be right every time; this is right by default."_
- `ACTOR_ONLY_CONTROLLERS` drives a **contract test so a new controller fails the suite until it is
  classified.**
- `cross-tenant-isolation.spec.ts` tests the boundary directly.

✅ **The strongest transferable idea in the whole comparison is the last two:** ⚠️ **make the DEFAULT
unauthorized and make a new surface FAIL until someone classifies it.** 🚫 Anything that requires
remembering will eventually not be remembered.

---

## 6. What AGE already has that RankOps does not

⚠️ Listed because it changes what "reuse the proven model" can mean: **on four points AGE's existing
design is stricter, and the proven model is the weaker one.**

|                  | RankOps                          | AGE (built, unused)                                                                                                                                 |
| ---------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session**      | JWT bearer, 🚫 **not revocable** | **Opaque 32-byte reference + a row**; `revokedAt`; **absolute expiry required** — there is no "never expires"                                       |
| **At rest**      | n/a (nothing stored)             | **SHA-256 digest only** — _"a stolen database dump then yields no usable session"_; constant-time compare                                           |
| **The answer**   | boolean (entitled / not)         | **three-valued: `granted` \| `denied` \| `not-established`** — 🚫 `not-established` never collapses to `denied`                                     |
| **Order**        | scope composed into a query      | 🛑 **the denial is RAISED BEFORE A QUERY EXISTS** — `openQuery` is a parameter _specifically so it can be proven not to have run_                   |
| **Failure mode** | empty result set                 | 🛑 **a denial raises; it never returns `[]`** — ADR-0068 §0.1d: _"an empty result set is not a proof"_                                              |
| **Rate limit**   | throttler                        | **two counters** (per subject AND per source) — _"neither is redundant"_; **counts failures, not requests**; 🚫 no allow-list, 🚫 no trusted source |
| **Cookie**       | n/a                              | `__Host-age_session`, HttpOnly/Secure/SameSite=Strict, browser-enforced prefix                                                                      |

⚠️ **And one AGE rule with no RankOps counterpart at all: `acceptSessionScopedClientContext` refuses a
tenant mismatch and 🛑 NEVER NARROWS IT.** _"Silently rewriting the organization to the session's
would turn a cross-tenant read attempt into a successful ordinary read, and nothing anywhere would
record that it happened. The caller asked for another tenant's data; that is the event."_ ⚠️ This is
what makes the owner's _"attempt to access another client is denied"_ a **provable** criterion rather
than an observed absence of rows.

---

## 7. What is safely reusable — CONCEPTUALLY

✅ **Adopt, with attribution, as shapes — 🚫 not as code** (different framework, different domain,
different tenancy model):

1. 🛑 **"A selection is a filter, never a grant"**, as an `AND` over an already-authorized set →
   **AGE-INV-SEL-1** (ADR-0074 §3).
2. 🛑 **One opaque refusal**, so unentitled ≡ nonexistent and the switcher is not an existence oracle.
3. ⚠️ **Entitlement re-read on THIS request**, never cached in the credential.
4. ⚠️ **The menu and the boundary derived from the SAME rule** — no menu of empty rooms.
5. ⚠️ **Malformed input answered like unentitled input**, checked beside the refusal, 🚫 not at the
   route.
6. 🛑 **Structural read-only** — a rule that excludes a future write surface **on the day it is
   added**, 🚫 not an allowlist someone maintains.
7. 🛑 **A contract test that FAILS until a new surface is classified.**
8. ⚠️ **The organization reached by TRAVERSAL**, so a client added later needs no new grant.
9. ⚠️ **Permission checked BEFORE the target is examined**, so refusal text is never an existence
   oracle.

🚫 **Do NOT adopt:** the JWT bearer session (§2) · the implicit, unrevocable super-admin grant (§4) ·
`legacyOwnerWhere` (a second authorization mechanism) · a `role` on the credential · a header
transport for the selection (§8.4).

---

## 8. What AGE must do DIFFERENTLY — and the ADR that forces each

🛑 **THE SECTION THE INSTRUCTION EXISTS FOR. Each row is a refusal already on record; 🚫 none is a
preference.**

### 8.1 🚫 No `clientId`-based authorization — the tenant is the ORGANIZATION

**ADR-0062 D1, ADR-0074 D5, and the owner's acceptance.** RankOps scopes to a **workspace** and the
workspace _is_ the tenant. AGE's tenant is the **organization**; a client is a **subject of
isolation**, 🚫 not an authorized capability. ⚠️ So AGE asks `askEntitlement` about the
**organization** — 🛑 **the `client` arm deliberately returns `not-established` and must stay that
way.** 🚫 Asking it instead would produce a check that refuses everything, which reads like a
boundary and is not one.

⚠️ **The binding already exists:** `ClientRecord` carries `organizationId`, and
`ClientContext(clientId, organizationId)` is already built from it. 🚫 Nothing needs inventing.

### 8.2 🚫 AGE mints no credential, and has no provisioning surface

**ADR-0068 §0.1a/§0.1c, ADR-0074 D4, restated in the acceptance.** RankOps has `register`, password
reset, Google sign-up. 🛑 **AGE has none of that and must not grow it.** The token is provisioned
**out of band, by an act** — the developer inserts one row, once — and AGE only ever **reads** a
credential it never issued. 🛑 **VERIFICATION IS NOT ISSUANCE.**

⚠️ **The store's grants make it true by shape**, 🚫 not by promise: `SELECT` only, so there is no
`INSERT` for a future _"just for the first one"_ helper to reach for.

### 8.3 🛑 The boundary is composed in `apps/studio` ONLY — the MCP trust boundary must not move

**The owner's acceptance, §0.3b.** ⚠️ This has no RankOps counterpart at all, and it is the sharpest
constraint in the slice. `apps/mcp` **binds nothing**, takes no `clientId` on either tool _"by shape,
not promise"_, and has no authentication of any kind. 🛑 **A session boundary added at a shared layer
would silently make it an authenticated surface — a trust-boundary change nobody decided.**

🚫 No shared middleware package · 🚫 no root interceptor · 🚫 no `@age/auth` another app could import.
⚠️ **A guard must assert `apps/mcp` imports nothing from the session or entitlement boundary.**

### 8.4 The selection is already in the URL — 🚫 and it is untrusted there

RankOps chose a **header** so routes need not grow a segment. ⚠️ **AGE's routes already carry it:**
`/b/[clientId]/{bif,evidence,discovery,sources,intelligence,…}` — eleven of them. So the mechanism is
🚫 not a header but **a per-request resolution**, and 🛑 **the URL segment is untrusted input, exactly
as a forged header would be.**

🛑 **THIS IS THE CONCRETE DEFECT THE SLICE FIXES.** Today `apps/studio` runs
`resolveBusinessScope(clientId)` straight off the route params — the literal
`caller → clientId → database` shape the owner forbade. ⚠️ After the slice the order is
`principal → entitlement → scope → allowed operation → data`, and 🚫 **there is no shared
"current client" a page may trust** (ADR-0058 D4's reasoning): every route re-derives it.

### 8.5 🚫 Refusals name a position, never contents

**ADR-0053 D4.** ⚠️ Stricter than RankOps' four distinct `ADMIN_CONTEXT_REFUSALS` texts. AGE's
refusals must not name a record's contents, another client's id, or an identifier at all — and
⚠️ **the token is never logged, never echoed, never defaulted**, because _"a token in a log is a live
session in a log."_

### 8.6 🚫 RLS is coherence, 🚫 NOT the isolation proof

**ADR-0046 D5, A6 item 5's own wording.** RankOps proves isolation with query predicates; AGE has RLS
**as well** and 🛑 **must not write the isolation test against it.** ⚠️ The policy checks the declared
scope against the row — correctly — but 🚫 cannot check that the declared scope is the caller's own,
because it is derived from the key the caller supplied. 🛑 **That is finding 3, and
`acceptSessionScopedClientContext` is what closes it.**

### 8.7 🚫 The epistemic rules survive authentication untouched

⚠️ Nothing about a login may change what AGE _says_. 🚫 `not-assessed` does not become an answer
because somebody signed in · 🚫 no BIF status is promoted · 🚫 `detectContradictions` is still not run
and there is still no import path to it · 🚫 `never-captured` and `captured-nothing-recorded` stay
apart. 🛑 **AGE-INV-PROV-1 stands: provenance alone never changes a score.**

### 8.8 🚫 No model call, and no API key required

**ADR-0060 D7, ADR-0070 D5, restated in the acceptance.** 🚫 Not for a login, 🚫 not for a summary on
a protected screen, 🚫 not behind a flag. ⚠️ **AGE must not require an LLM API key to run**, and the
deployment must start without one.

### 8.9 🚫 Studio's data is not only a database

⚠️ Unlike RankOps, where every tenant fact is a row, **AGE Studio reads the operator's own workspace
on disk** (client records, discovery answers, drafts, confirmations) _and_ Postgres (snapshots,
observations). 🛑 **So isolation is not a `where` clause alone** — the workspace root is derived from
the **authenticated organization** and 🚫 never from a request parameter (ADR-0061 A4), and
`assertOperatorFilePathOutsideRepository` keeps its **ONE** implementation (ADR-0054 D2/D3).

⚠️ **A path is a tenancy boundary here**, and 🚫 a query-shaped mental model imported from RankOps
would miss it entirely.

---

## 9. The smallest equivalent AGE implementation

⚠️ Mapped one-to-one, so what is **new** is visible against what is **wiring**.

| RankOps                                | AGE equivalent                                              | Status                                      |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `AuthService.login` (password)         | **paste the provisioned token** (A1)                        | 🆕 **route only**                           |
| `AuthTokenService.issue`               | 🚫 **nothing — AGE mints no credential**                    | 🚫 refused (D4)                             |
| `JwtStrategy.validate`                 | `verifyPresentedSessionToken` + `findRowByTokenHash`        | ✅ **exists**                               |
| Bearer header                          | `__Host-age_session` cookie                                 | ✅ **exists**                               |
| `req.user.role`                        | 🚫 **nothing — no role on a session**                       | 🚫 refused (D6)                             |
| `tenantAccessWhere`                    | `askEntitlement({ organization })`                          | ✅ **exists**                               |
| `readableSiteWhere`                    | the client registry, filtered by `organizationId`           | ✅ **exists**                               |
| `resolveSelection`                     | resolve `clientId → organizationId`, then entitlement       | 🆕 **small**                                |
| `applySelection` (`AND`)               | `acceptSessionScopedClientContext`                          | ✅ **exists**                               |
| `scopedWhere` guard                    | `ClientContextBound…Repository`                             | ✅ **exists**                               |
| `SELECTION_REFUSAL`                    | one refusal, declared once                                  | 🆕 **small**                                |
| `auth-throttle`                        | `@age/auth-rate-limit`                                      | ✅ **exists**                               |
| logout                                 | **`revokedAt` on the row**, cookie expired as a consequence | 🆕 **small**                                |
| audit                                  | 🚫 **nothing**                                              | 🆕 **A6 item 6 — the only empty gate item** |
| `ACTOR_ONLY_CONTROLLERS` contract test | a route guard that fails on an unclassified route           | 🆕 **required**                             |

🛑 **FOUR NEW THINGS AND ONE EMPTY GATE ITEM. Everything else is composition.**

## 10. What this comparison does NOT settle

1. 🚫 **The Super Admin.** RankOps has one; AGE does not, and 🚫 must not prepare for one. ⚠️ RankOps'
   own note is the argument for keeping it out of the read scope when it arrives. Its own ADR — with
   ADR-0062 §6.3's unanswered question, _"who creates an admin, and what audits one?"_
2. 🚫 **Client login.** RankOps clients log in; AGE's do not, and 🚫 no code prepares for it.
3. ⚠️ **The tenth operator.** A1 does not scale and was accepted knowing it (ADR-0074 §8.2).
4. ⚠️ **The workspace root when there is a SECOND organization** (ADR-0061 A4). `deploy-studio.sh`
   names one workspace path for the whole host, which A4 does not permit past one organization.
   🚫 Out of scope; it binds the slice that adds a second organization, 🚫 not a second operator in the
   same one.

---

⚠️ **A closing caution, from the RankOps round trip's own record:** the adapter's first envelope was
refused by AGE **while both typecheckers and every unit test on both sides were green**. 🛑 **A
compiling interface is not the test.** The owner's definition of done — real data, real running
paths, a real `denied` — is 🚫 not a formality, and 🚫 a green suite must not be reported as if it
were that proof.
