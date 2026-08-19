# ADR-0083 — the platform principal: track checkpoint

> Records what has been **measured**, and — the half that matters more — what each measurement
> does **not** prove. 🚫 Nothing here is a VPS fact unless it says so.

---

## 1. What ADR-0083 decided, and what it deliberately did not

D1 chose **option B**: a platform session gets its **own type**, not a nullable `organizationId` on
the tenant one. D2 required the tenant path to be **unchanged, asserted by measurement**. D3 put
expiry and revocation at **exactly one implementation** for both principals. D4 put the branch
between the two principals in **`requireRequestScope()` and nowhere else**, and kept that module as
`@age/access-scope`'s **only importer**. D5 fenced platform rows by the **digest of the token being
presented**, never by a tenant.

🛑 The ADR closes with the boundary of its own authority: _"🚫 Not a rendering, 🚫 not a reach,
🚫 not a deployment, 🚫 not a provisioned super-admin."_ Every one of those four is still true.

---

## 2. Slices merged

| Slice | What landed                                                                      | PR          |
| ----- | -------------------------------------------------------------------------------- | ----------- |
| C1–C2 | the `SessionPrincipal` union, `VerifiedPlatformSession`, the one composed reader | #401–#404   |
| C3    | the digest-fenced scope runner, the platform lookup, revocation and issuance     | #405        |
| C4a   | the studio wiring — admission, the D4 branch, the platform logout                | #406        |
| C4b   | the callback reads both channels and ISSUES a platform session                   | this branch |

---

## 3. What C4a actually changed

- **`session-boundary-decision.ts`** — the boundary now returns an **`admitted` principal** rather
  than a session. The refusal `platform-scope-not-yet-served` was **deleted, not kept as a
  fallback**; the refusal moved to `requireVerifiedSession`, where it belongs.
- **`session-boundary.ts`** — `requireVerifiedSession` keeps its `Promise<VerifiedSession>`
  signature and redirects a platform principal to `/sign-in?refused=scope-not-served`. The
  one-character alternative — returning `decision.principal.session` for both arms — **the compiler
  refuses**, which is the whole reason D1 chose a separate type.
- **`request-scope.ts`** — the D4 branch. `platformScope()` is called here and nowhere else in the
  product. `requireScopedAccess` refuses a platform principal **by name**, and the new
  `TenantScopedRequest` return type meant all **fourteen action call sites stayed byte-identical**
  (D2 — a narrowing at the gate rather than fourteen checks behind it).
- **`operator-environment.ts` / `deployed-session-composition.ts`** — the tenant read and the
  platform read composed with `??` (🚫 never `||`) in the **one** composed reader, plus
  `revokePlatformSessionByDigest`.

---

## 4. The mutation pass — six breaks, each naming the exact violation

🚫 A guard that has only ever passed is not evidence. Each mutation below was applied, run, and
reverted by a **targeted inverse edit** (🔴 never `git checkout <file>`).

| #   | Mutation                                                                              | What the failure said                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | deleted the platform arm of `requireRequestScope`, falling through to the tenant read | the scope test, the "never reads the tenant directory" test, both gate tests, **and** the call-site guard flipping to `[]` — so the guard notices **absence**, not only excess |
| 2   | removed the `notFound()` for a platform principal at the action gate                  | _"A subject with a blank agencyId is not…"_ — the fall-through named the missing **subject**, which is precisely the reason the refusal exists                                 |
| 3   | routed platform logout through `revokeSessionById` with a pinned organization         | the digest-fence assertion, and the "fences on the token THIS REQUEST presented" case                                                                                          |
| 4   | returned the session for both arms in `requireVerifiedSession`                        | _"promise resolved instead of rejecting"_ — a tenant page rendered for a platform principal                                                                                    |
| 5–6 | planted `packages/session-store/src/planted-scope.ts` calling `platformScope()`       | the call-site guard named the planted file **by path**; the shipped `@age/access-scope` importer guard named it too                                                            |

⚠️ Mutation 2's message is the one worth keeping: a platform principal is refused for having **no
subject**, 🚫 not for lacking a capability — `platformScope()` holds every atom.

---

## 5. A real gap, named rather than papered over

🛑 **There is no directory re-read on the platform arm.** The tenant re-read exists to catch a
membership revoked since sign-in; the equivalent for a platform operator is a read this console
does ❌ not have, because `readDirectoryEntryByAccount` is scoped by organization and there is
none.

**Consequence, stated plainly:** a platform membership revoked mid-session is caught at **token
expiry (8 hours)**, 🚫 not on the next request. The tenant guarantee of ADR-0079 §2 property 2 is
therefore **weaker on this arm**.

🚫 The tempting fix — passing the deployment's pinned organization to make the re-read "work" — is
exactly the substitution **ADR-0082 D4 forbids**: it would answer a question about a tenant this
principal never named. Closing this gap needs an organization-free directory read, and that is a
**new decision**, not a slice.

---

## 6. Verification — and its limits

Repository, 2026-08-19:

- `nx run-many -t typecheck` → **64 projects**, exit 0
- `nx run-many -t lint` → **64 projects**, exit 0
- `nx run-many -t test --skip-nx-cache` → **64 projects**, exit 0 (`--skip-nx-cache` is not
  optional when proving mutations: a violation planted outside a guard's own package leaves that
  package's inputs unchanged, and the cache reports a false green)
- `apps/studio` — **335 tests / 31 files**, of which **13 are new** (322 → 335) in
  `platform-principal-boundary.test.ts`

🛑 **None of this is a VPS fact.** ADR-0079 slice 4 is still not deployed, and neither
`20260819000000_platform_membership_sign_in_read` nor
`20260819100000_platform_sessions_without_an_organization` has been applied to the deployed store.

🛑 **What C4a did ❌ NOT prove:** that a platform operator can sign in. That is **C4b**, below.

---

## 7. C4b — the callback issues a platform session

### What changed

- **`@age/sign-in-directory`** — one new pure function, `decideSignInAcrossDirectories`, plus one
  new refusal reason, `crossed-directory-channel`. 🚫 It forms no new opinion: every admission and
  every refusal it returns is `decideSignIn`'s, unchanged.
- **`apps/capture/src/deployed-sign-in-composition.ts`** — the same authorized door grows
  `findPlatformDirectoryEntry` (the ADR-0080 fenced read) and `issuePlatform` (the ADR-0083 D5
  digest-fenced insert). 🚫 No third door, and 🚫 no new grant.
- **`apps/studio/src/server/operator-environment.ts`** — `readPlatformDirectoryEntry(email)` and
  `issuePlatformSession(accountId, token, issuedAt)`. ⚠️ **The second one has no organization
  parameter at all**, which is where the ADR-0082 D4 substitution is prevented rather than checked.
- **the callback** — reads **both** channels and branches on `organizationId === null`.

### 🛑 Both channels are read, and neither is "first"

The tenant read compares `organization_id` for equality, so 🚫 it can never return a platform
membership; the fenced platform read sets 🚫 no `age.organization_id`, so 🚫 it can never return a
tenant's people. ⚠️ Asking one and falling back to the other would make the **order** decide which
membership wins — and `decideSignIn` refuses exactly that question, by name, inside one entry.
Provisioned in both is therefore **`ambiguous-membership`**, 🚫 not a precedence.

### The mutation pass — six breaks

| #   | Mutation                                                                            | What the failure said                                                                                      |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | issued the platform session through `issueOperatorSession(lookupOrganizationId, …)` | _"expected [] to deeply equal [ { …(2) } ]"_ — the tenant path taken, and the one-caller guard flipped too |
| 2   | deleted the crossed-channel refusal on the tenant arm                               | both layers named it: the pure spec and the route's "a platform row through the TENANT channel"            |
| 3   | let a platform admission win when both channels admit                               | _"expected '/' to be '/sign-in?refused=ambiguous'"_ — a precedence where the rule says refusal             |
| 4   | read the platform channel with an address that was not the verified one             | _"expected [ 'someone-else@…' ] to deeply equal [ 'operator@…' ]"_                                         |
| 5   | planted `apps/studio/src/server/planted-platform-read.ts`                           | the ADR-0080 fence guard named the planted file **by path**                                                |
| 6   | routed `issuePlatformSession` through the tenant `store.issue`                      | 🛑 **the COMPILER refused it** — `TS2345`, because the platform request has no `organizationId` to give    |

⚠️ Mutation 6 is the one worth keeping: the substitution ADR-0082 D4 forbids is not caught by a
test here, it is **unrepresentable**. That is D1's separate type paying for itself a second time.

### Verification — and its limits

Repository, 2026-08-19: `typecheck`, `lint` and `test --skip-nx-cache` each **64 projects**, exit 0;
`pnpm --filter @age/persistence typecheck:db` exit 0 (⚠️ it is 🚫 **not** part of
`nx run-many -t typecheck`, and it caught a real defect in C4a); `apps/studio` **344 tests /
31 files** (335 → 344), `@age/sign-in-directory` **31 tests** (22 → 31).

🛑 **None of it is a VPS fact, and 🚫 nobody has signed in.** The two migrations are still not
applied to the deployed store, the console still runs the pre-ADR-0079-slice-4 image, and
🛑 **there is still no super-admin row** — provisioning is a **human act**, and 🚫 nothing in this
slice creates one. What this slice proves is that **if** such a row existed, the callback would
issue a session that belongs to no organization.

⚠️ **The C4a gap is unchanged:** there is still no directory re-read on the platform arm, so a
platform membership revoked mid-session is caught at 8-hour token expiry (§5).

---

## 8. Open, and all the owner's

- **ADR-0080 (`Proposed`, PR #385)** — the super-admin cannot sign in.
- **ADR-0081 (`Proposed`, PR #386)** — the fifth `age-deploy` wrapper.
- **ADR-0079 D5**, **ADR-0076 D8**, and the **provenance threshold**.
- **The super-admin provisioning run itself** — 🛑 AGE mints nothing; provisioning is a human act.

🚫 No slice may assume an answer to any of these.
