# ADR-0090 — minted client identity: slice checkpoint

> Evidence for the one slice that implemented ADR-0090. 🛑 **This file records what was
> MEASURED, and says plainly what was not.** ⚠️ Repository facts and host facts are kept apart on
> purpose: CI green is not host proof, and neither is a browser gate.

Written **2026-08-22**, at `main` **`5200f4c`**.

---

## 1. The decision this implements

**ADR-0090 — "The identity a new client record is given."** `Status: Accepted (2026-08-22)`,
🛑 **accepted by the ARCHITECT and 🚫 not by the owner**: the decision is internal, reversible in
code, and reachable from the accepted ADRs, so under constitution §5 it is mine and the owner's
signature is 🚫 not spent on it.

- **D1** — a new record's `clientId` is **minted by AGE**; the form 🚫 no longer asks for one.
- **D2** — `organizationId` is **derived from the session**; it is **rendered read-only**, 🚫 not
  asked for. ⚠️ Showing it is 🚫 not asking for it.
- **D3** — the mint happens at the **effect edge**, 🚫 never in the pure package.
- **D4** — 🛑 **existing records keep the ids they have, and there is NO migration.**
- **D5** — the minted form is `cli_` + 32 hex, from `randomBytes(16)`.

🛑 **THE "AGE MINTS NOTHING" REFUSAL IS UNTOUCHED.** The word "mint" in D1 is about an
**identifier** — 🚫 never a credential, a session, an account or a membership. The refusal held by
name across ADR-0068, 0074, 0079, 0080, 0082, 0083 and 0086 still stands.

## 2. The slice

- Branch **`feat/minted-client-identity`**, based on `main`, one slice, one PR.
- **PR #424**, squash-merged to `main` **`5200f4c`**; branch deleted.
- 13 files changed, +616 / −101.

| File                                                | What changed                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/studio/src/server/operator-environment.ts`    | `mintClientId()` — `randomBytes(16)`, and it runs `assertSafeClientIdForFileName` **on its own output** |
| `apps/studio/src/server/client-actions.ts`          | mints the id, derives the organization from the session, passes both **in**                             |
| `packages/studio-shell/src/client-record-draft.ts`  | takes a supplied identity; validates it exactly as before                                               |
| `apps/studio/src/components/create-client-form.tsx` | two fields — `displayName`, `externalRefs`; the organization is **text, not a control**                 |
| `apps/studio/src/app/businesses/new/page.tsx`       | passes the resolved organization down                                                                   |
| + 5 test files, 1 barrel export, the ADR            | see §3                                                                                                  |

## 3. The five guards, and the mutation that proved each

⚠️ **Every guard was proven by DELIBERATE MUTATION before it was believed** (constitution §5), and
restored by a **targeted inverse edit** — 🔴 never `git checkout <file>`.
🚫 A guard that has only ever passed is not evidence.

| #   | Guard                                                                                                                                                                                 | File                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | A minted id is **never a slug of the display name** — no normalised 3-char run of the name appears in the id                                                                          | `apps/studio/src/server/minted-client-identity.test.ts`               |
| 2   | Two records with the **same display name** get **different ids**                                                                                                                      | same                                                                  |
| 3   | The minted id matches `/^cli_[0-9a-f]{32}$/`, passes `assertSafeClientIdForFileName`, and 256 draws are all distinct                                                                  | `apps/studio/src/server/minted-client-id-shape.test.ts`               |
| 4   | The record is written into the **session's** organization; a submission naming another is not honoured                                                                                | `minted-client-identity.test.ts`, `client-action-entitlement.test.ts` |
| 5   | 🛑 The **pure package still mints nothing** — a **package-wide** scan of `@age/studio-shell` for `randomUUID`, `randomBytes`, `Math.random(`, `Date.now(`, `new Date(`, `node:crypto` | `packages/studio-shell/src/mints-nothing.spec.ts`                     |

### 3a — 🛑 Guard 3 exists because its FIRST DRAFT was worthless

The first version of the shape guard lived alongside the action tests, which `vi.mock`
`./operator-environment`. `vi.mock` is **hoisted**, so importing `./operator-environment` resolved
to the **stub**, and the guard asserted the stub's own id shape. It would have passed no matter
what shipped.

⚠️ **A guard aimed at an implementation it cannot reach is a guard that has only ever passed.** It
was split into its own file, which imports the **real** module and carries a doc comment forbidding
a mock there.

### 3b — 🛑 Guard 5 is package-wide because a narrow scan is not a narrow rule

Several view specs already assert `Date.now(` and `Math.random(` are absent **from their own
source** — and every one of those passes while a neighbouring module grows a clock. Guard 5 scans
the whole `src/` tree and its failure names the **file and the token**. It carries a **vacuity
check** (more than 20 files scanned), which earned itself immediately: a first attempt used a
pattern matching a literal backslash, so the scan covered **zero** files — and the vacuity check
failed on the very first run rather than reporting a clean sweep of nothing.

### 3c — ⚠️ A superseded refusal was rewritten, 🚫 not relaxed and 🚫 not deleted

The old rule was _"a mismatched `organizationId` is refused, naming the field."_ With D2 the field
is gone from the form, so that refusal is **unreachable** — 🛑 it was made unreachable, 🚫 not
widened. Its four cases in `client-action-entitlement.test.ts` were **rewritten** to assert the
surviving property — _the record is written into the session's organization, whatever the
submission says_ — looping several hostile organization values, with a doc comment stating that
the outcome **changed** rather than dropping the property silently.

## 4. What was measured

### 4a — Gates and CI (repository facts)

- All local gates green across the workspace, plus `@age/persistence typecheck:db`.
- **Pre-merge CI green on the FULL `head_sha`** `d3cc753cfac0e82eeef7928dbb1f6b2f01fbf286`
  — run **32558121957**, **15 steps EXECUTED**. 🚫 Not "the newest success"; 🚫 0 steps is not a
  gate.
- **Post-merge CI green on the merge SHA** `5200f4c…` — run **32558476408**, **15 steps executed**.

### 4b — The deploy (host facts)

Deployed with `scripts/deploy-studio.sh` as `age-deploy`. `age-studio` rebuilt, recreated, **Up**,
and **serving** — `/sign-in` answers inside the container.

🛑 **ADR-0076 D7 RE-PROVEN BY RAW TCP CONNECT FROM INSIDE THE RUNNING CONTAINER**, 🚫 not inferred
from a query that returned nothing:

| Target                        | Result      | Expected |
| ----------------------------- | ----------- | -------- |
| AGE postgres (`age-internal`) | **ALLOWED** | ALLOWED  |
| SNARA postgres                | **DENIED**  | DENIED   |
| RankOps postgres              | **DENIED**  | DENIED   |
| Drishti postgres              | **DENIED**  | DENIED   |
| Scanner mysql                 | **DENIED**  | DENIED   |

- **D3:** published on **`127.0.0.1:3100` only**.
- Public: `https://age.digitaldadi.agency/` → **307** → `/sign-in`; `/sign-in` → **200**.

⚠️ `age-deploy-docker-probe` refused an `exec-studio` verb (it allows `inspect, logs, exec-probe,
ps`). 🛑 **The wrapper was NOT widened to make something pass** — the public `curl` check was used
instead, and its limit is stated rather than papered over.

## 5. 🛑 WHAT THIS DOES NOT PROVE

🚫 **NOBODY HAS CREATED A BUSINESS THROUGH THE DEPLOYED CONSOLE WITH THE TWO-FIELD FORM.**
`/businesses/new` is a **browser gate**, ADR-0090 §6 names it explicitly, and **it has not been
opened**. 🚫 CI is not that gate, 🚫 `curl` is not that gate, 🚫 the merge is not that gate.

⚠️ Creating a **real** client record is an **owner act** (constitution §5, §7). It is 🚫 not
substituted by a fixture, and 🚫 no real client record is committed.

## 6. What is still owed

1. **`/businesses/new` in a browser** — the two-field form, unopened. Owner act.
2. **`/client` in a browser** — the third tier, still never loaded by anyone.
   `provision-client-viewer.sh` is on the box; the provisioning itself is an owner act.
3. 🛑 **ADR-0091, `Status: Proposed`, the membership-provisioning path** — ADR-0090 §7 defers it by
   name. Granting a person access still requires **root SSH and a bash script**. Moving it into the
   console would overturn _"AGE mints nothing"_ **and** provisions a real person: the **owner's
   class twice over**. It is owed as a **decision request** that authorizes nothing.
