# ADR-0089 checkpoint — the platform arm re-reads the membership it stands on

**Slice:** ADR-0089 (Accepted 2026-08-21, **Option D**), whole.
**Branch:** `feat/platform-membership-reread`, base `main`. **PR:** #419, squash-merged.
**Merge SHA on `main`:** `ab2dd553f81114206aa68af1f9a56391bb18d2ee`.

---

## 1. What moved

Three things, exactly as ADR-0089 §5 named them:

1. `packages/persistence/.../20260821000000_platform_membership_request_reread/migration.sql` — two
   ADDITIONAL `FOR SELECT` policies keyed on `age.platform_sign_in_account`. 🚫 No new grant, 🚫 no
   INSERT policy, 🚫 no FORCE RLS change. Permissive policies OR together, so a transaction setting
   neither key behaves **exactly** as before.
2. `packages/sign-in-directory-persistence/src/platform-account-read.ts` — `PlatformAccountRunner`,
   `PrismaPlatformAccountRunner`, `platformDirectoryReadByAccount`. 🛑 **It takes an account id and
   nothing else**; the ADR-0082 D4 substitution is made **unrepresentable**, 🚫 not merely forbidden.
3. `decideSignIn(entry, organizationId: string | null)` — one admission function, widened. `null`
   means _there is no tenant channel_, 🚫 **not "any tenant"**, and the empty list is written out
   rather than left to `=== null` (a malformed `agency` row with a NULL organization would otherwise
   have matched a request that HAS no organization).

`apps/studio/src/server/request-scope.ts` platform arm now re-reads and refuses
`not-provisioned` before returning a platform scope.

## 2. Guard discipline — all six §7 guards, mutated first

Each guard was written, the implementation deliberately broken, the failure read to confirm it
**named the exact violation**, then restored by a **targeted inverse edit** (🚫 never
`git checkout <file>`).

🛑 **ONE MUTATION INITIALLY SURVIVED, AND THE GUARD WAS WIDENED, 🚫 NOT THE MUTATION WEAKENED.**
Passing the pinned organization as a second argument failed nothing, because my own test factory
`(accountId) => spy(accountId)` **swallowed** the extra argument — a guard scoped narrower than its
rule, which is how all three of this repo's audit gaps arrived. Fixed to `(...args)`; the guard then
failed with `expected [ Array(2) ] to have a length of 1 but got 2`.

## 3. Repository facts

- `pnpm lint`, `typecheck`, `test`, `build` — 64 projects, green. Studio alone: 416 tests, 36 files.
- CI matched to the **FULL** `head_sha` `06fcb6197c28427a11c94318204a263168933380`, steps enumerated
  as **executed** (24 and 27 respectively, all `success`) — 🚫 not "the newest success", 🚫 not 0 steps.
- Post-merge CI on `main` `ab2dd553f81114206aa68af1f9a56391bb18d2ee` — both workflows `success`.

## 4. 🛠️ HOST FACTS — MEASURED ON THE BOX, 2026-08-21

⚠️ Everything in this section was **measured on the VPS**. 🚫 None of it is a repository
assumption, and 🚫 CI proved none of it.

**The deploy.** `scripts/deploy-studio.sh` ran to completion. `age-studio` rebuilt and recreated;
`/sign-in` answers inside the container; ADR-0076 D7 re-proven from **inside the running container**
(AGE store ALLOWED; SNARA, RankOps, Drishti postgres, Scanner mysql each DENIED); published on
`127.0.0.1:3100` only.

**The migration**, through the sanctioned `docker-compose.age-migrate.yml` — `migrate deploy`,
🚫 never `migrate dev`, as `age_owner`, inside `age-postgres`’s own network namespace, the
credential read on the box and 🚫 never placed in `argv`:

```
migration: 20260821000000_platform_membership_request_reread
           finished=2026-08-21 17:45:55.707957+00  steps=1  rolled_back=no
policy:    accounts_select_for_platform_account_reread            on accounts
policy:    account_memberships_select_for_platform_account_reread on account_memberships
```

### 🛠️ THE ADR-0089 §8 MEASUREMENT — TAKEN, AND THIS IS IT

A raw connection as **`age_app`** (NOSUPERUSER, NOBYPASSRLS — 🚫 not the owner, which would
bypass every policy and prove nothing):

| transaction                                         | `accounts` | `account_memberships` |
| --------------------------------------------------- | ---------- | --------------------- |
| 🛑 no setting at all                                | **0**      | **0**                 |
| `age.platform_sign_in_account` = the proved account | **1**      | **1**                 |
| ⚠️ a stranger’s account id                          | **0**      | —                     |
| a fresh transaction, after commit                   | **0**      | **—**                 |

Which is the whole of what the ADR claimed, now as fact rather than as intent:

- 🛑 **IT FAILS CLOSED.** Without the fence the reader sees **nothing** — 🚫 not everything.
- ⚠️ **IT IS A DOOR, 🚫 NOT AN ACCOUNT ORACLE.** A stranger’s id reads **0**, so the policy
  cannot be used to ask _“does this account exist in AGE”_ — the `EXISTS` clause is doing the work
  it was written for.
- ⚠️ **THE SETTING IS GENUINELY TRANSACTION-LOCAL.** The next transaction on the SAME connection
  read **0**, so the `set_config(…, true)` form does not leak a previous operator’s account to
  whoever borrows that pooled connection next. 🛑 That is the hazard the form exists to prevent,
  and it is now measured rather than reasoned about.

**Two blemishes in the measurement script, neither touching a result.** An apostrophe inside a
`\echo` comment broke that one comment line (`unterminated quoted string`); the query beneath it
still ran and returned `0`. And `select set_config(…)` echoed the opaque account id into the
output — ⚠️ not a credential and 🚫 not client data, but it was meant to stay unprinted.

### ✅ The regression this closes

Between the deploy and the migration the code was live and the policies were not, so the platform
arm refused `not-provisioned` on every request — failing **closed**, the safe direction, but 🚫 not
the intended one. That window is over.

### ⚠️ STILL NOT PROVEN: THE BROWSER

🛑 **Nobody has signed in since the migration.** The measurement above proves the DATABASE answers
correctly to a raw connection; 🚫 it proves nothing about a platform operator actually reaching a
page. `curl` is not a browser and neither is `psql`. ⚠️ The browser gate is the owner’s, and
🚫 I never sign in as them.

### ⚠️ Two route facts worth keeping, because they cost a round trip each

- 🛑 **THE ROOT KEY INSTALL RECORDED FOR 2026-08-21 DID NOT TAKE.**
  `ssh root@185.255.131.94` still answers `Permission denied (publickey)`. The handover said the
  owner should confirm it and 🚫 it was never confirmed — this is that confirmation, negative.
- 🚫 **`age-deploy` CANNOT APPLY A MIGRATION, BY DESIGN** (ADR-0077). Its five wrappers cover
  compose-up, derive-env, docker-probe, nginx-apply and settings-apply; 🚫 none runs SQL. So a
  migration needs a sudo-capable account, and today that means the owner runs it.
  🚫 I did not hand-apply the two `CREATE POLICY` statements as the superuser to get around the
  blocked route: that would have recorded a migration that never ran through `migrate deploy`, and
  _the SQL that was reviewed is the SQL that ran_ (ADR-0032 D8) would have become false quietly.

## 5. Still open, and 🚫 none of it is a slice

ADR-0084 slice 1 (the browser header measurement) · the browser gate on every deployed sign-in
change — 🚫 I never sign in as the owner · the provenance threshold, and with it the first real
client record (⚠️ a name in **prose** is client data too, so it is 🚫 not written here) · the symlink
question · ADR-0076 D8 · ADR-0079 D5 · ADR-0072 is `Proposed`; the gap-C ageing ADR is unwritten.
