# ADR-0086 — The name a host puts on its organization

Status: **Accepted** (2026-08-21)

🛑 **ACCEPTED BY THE PRODUCT OWNER**, 2026-08-21, verbatim:

> _"2 make ADR yes, i am ok with picker and organisation name we decided."_

⚠️ The owner also confirmed the **browser gate** in the same message — asked whether the picker
renders the name, they answered _"Yes"_. `AGE_STUDIO_ORGANIZATION_NAME` was set on the host through
the wrapper (`len=12`, value 🚫 never printed) and the console recreated; the owner then saw the
label. ⚠️ **That is the first MEASUREMENT of this decision** — 🚫 nobody had opened the picker
between the restart and their answer, so until then it was an expectation.

⚠️ **Written alongside the code rather than before it**, on the same standing instruction recorded
in ADR-0085 §0. 🛑 The owner accepts or rejects; a separate PR flips the status with their words
verbatim, and 🚫 this is not owner acceptance of anything.

Depends on: ADR-0081 (the fifth wrapper and its allow-list) · ADR-0085 (the organization a platform
operator chose).
Amends: **ADR-0081 D2** — one name is added to the wrapper's allow-list. Supersedes: nothing.

---

## 1. Why

The picker ADR-0085 shipped renders a machine identifier. The operator asked for a readable name,
and the obvious reading of that request — _"fix the organization table thing"_ — invites a real
`organizations` table.

🛑 **A TABLE IS 🚫 NOT WHAT A LABEL NEEDS, AND BUILDING ONE HERE WOULD BE THE EXPENSIVE WRONG
ANSWER.** A table means a migration, an RLS policy, a write path, and a provisioning path — and
AGE **mints nothing** (constitution §1), so the provisioning path is the part that cannot exist as
designed. It would also be infrastructure for multi-organization deployments, which 🚫 nobody has
decided to build: one host still serves one organization.

What was actually missing is one string.

## 2. The decision

**The organization's display name is a host setting, `AGE_STUDIO_ORGANIZATION_NAME`, and it is a
LABEL — 🚫 never an identifier.**

`organizationsThisConsoleServes()` returns `{ id, displayName }`. Every comparison in the product is
against `id`: the choice cookie, the form submission, the session that gets composed, every row that
gets filed. `displayName` is rendered and nothing else.

⚠️ **AN UNNAMED ORGANIZATION RENDERS AS ITS `id`.** 🚫 Not blank, 🚫 not prettified, 🚫 not
title-cased into a guess. The id is what the deployment actually knows, and a name AGE invented
from `digitaldadi` would be a fact nobody stated (constitution §2, _absence is never a
conclusion_).

## 3. 🛑 The widening, said plainly

ADR-0081 D2 records that _"adding one more name is exactly how this wrapper becomes an arbitrary
root write"_, so this addition is argued rather than assumed.

`AGE_STUDIO_ORGANIZATION_NAME` is **inert**. It is 🚫 never compared, 🚫 never a scope, 🚫 never a
key, and 🚫 never a route to a database. The property that makes `DATABASE_URL_APP` permanently
unlistable — that a caller who could rewrite it could point the console at a database of their
choosing — has no analogue for a label. ⚠️ The allow-list is still asserted by **exact equality** in
`deploy-wrapper-boundary.spec.ts`, so the next addition is as deliberate as this one.

## 4. The guard, and the one that nearly did not work

`platform-principal-boundary.test.ts` offers the **display name** as the choice cookie and requires
a refusal, because a host that serves the organization and a value that IS its name is the case a
name-matching comparison would admit while looking entirely reasonable.

🛑 **THE FIRST VERSION OF THAT GUARD PASSED WITHOUT PROVING ANYTHING, AND IT IS RECORDED RATHER THAN
QUIETLY FIXED.** The fixture label was `'Fictional Alpha Holdings'`. The cookie reader rejects that
shape, so the request never reached the comparison under test and the redirect came from the
**parser**. Measured 2026-08-21: with that fixture, deliberately matching on `displayName` in
`acting-organization.ts` **still passed all 396 tests**. The label was changed to an
identifier-shaped value that survives the reader, and the mutation then failed as it should.

⚠️ **THE LESSON IS THE STANDING ONE**: a guard whose input dies at an earlier layer proves that
layer, 🚫 not the rule it was written for.

## 5. What this does NOT authorize

- 🚫 **No `organizations` table**, no organization rows, no organization writes.
- 🚫 **No multi-organization deployment.** One host, one organization, unchanged.
- 🚫 **No lookup by name.** There is no route, query, or form that resolves a label to a scope.
- 🚫 **No name on any other entity.** This is the ONE organization a deployment serves; clients keep
  the display names they already carry in the operator record file.
