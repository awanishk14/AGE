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

## 4. 🛑 HOST FACTS — WHAT WAS MEASURED, AND WHAT WAS NOT

**Measured on the box, 2026-08-21:** `scripts/deploy-studio.sh` ran to completion. `age-studio`
rebuilt and recreated; `/sign-in` answers inside the container; ADR-0076 D7 re-proven from **inside
the running container** (AGE store ALLOWED; SNARA, RankOps, Drishti postgres, Scanner mysql each
DENIED); published on `127.0.0.1:3100` only.

🛑 **NOT MEASURED, AND 🚫 NOT DONE: THE MIGRATION IS NOT APPLIED.** ADR-0089 §8 says the RLS half is
a host fact and 🚫 not a repository one, and it is named here so it cannot be reported as done on the
strength of green CI. It is not done. The raw-connection measurement it demands — that `age_app`
reads **nothing** without `age.platform_sign_in_account` set, one row with it, **zero** for a
stranger's account id — has 🚫 not been taken.

### 🛑 THEREFORE THERE IS A LIVE REGRESSION ON THE PLATFORM ARM, RIGHT NOW

The code is deployed and the policies are not. The new read sets the key, the database exposes no
rows for it, so **a platform operator is refused `not-provisioned` on every request** until the
migration runs. ⚠️ It fails **closed**, which is the safe direction — 🚫 but it is not the intended
one, and the owner is the only provisioned platform principal.

### Why I stopped rather than proceeding

The migration runs through `deploy/vps/compose/docker-compose.age-migrate.yml` as the **owner**
role, and every route to it needs privilege `age-deploy` deliberately does not have (ADR-0077): its
five wrappers cover compose-up, derive-env, docker-probe, nginx-apply and settings-apply — 🚫 none
runs SQL. The direct root route is blocked in this session by the harness classifier. 🚫 I did not
work around it, and 🚫 I did not hand-apply the two `CREATE POLICY` statements as the superuser to
get past it: that would record a migration that never ran through `migrate deploy`, which is the
"the SQL that was reviewed is the SQL that ran" property (ADR-0032 D8).

### The exact command, for the owner

`AGE_DB_OWNER_URL` is held by the human and 🚫 is not on the box. From a shell with it in the
environment (🚫 never in `argv`, 🚫 never `sudo -E`):

```
export AGE_DB_OWNER_URL_CONTAINER=$(printf '%s' "$AGE_DB_OWNER_URL" | sed -E 's#@[^@/]+:[0-9]+/#@127.0.0.1:5432/#')
sudo --preserve-env=AGE_DB_OWNER_URL_CONTAINER \
  docker compose -f /home/age-deploy/age/deploy/vps/compose/docker-compose.age-migrate.yml \
  --project-directory /home/age-deploy/age run --rm migrate
```

Expect `20260821000000_platform_membership_request_reread`, `steps=1`, `rolled_back=no`.

## 5. Still open, and 🚫 none of it is a slice

ADR-0084 slice 1 (the browser header measurement) · the browser gate on every deployed sign-in
change — 🚫 I never sign in as the owner · Doctor at Door / the provenance threshold · the symlink
question · ADR-0076 D8 · ADR-0079 D5 · ADR-0072 is `Proposed`; the gap-C ageing ADR is unwritten.
