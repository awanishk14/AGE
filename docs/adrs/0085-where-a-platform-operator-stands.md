# ADR-0085 — Where a platform operator stands

Status: **Proposed** (2026-08-20)

🛑 **THIS ADR REVERSES A SHIPPED REFUSAL, AND IT DOES SO ON THE PRODUCT OWNER'S EXPLICIT
INSTRUCTION**, given in this session, verbatim:

> _"A super admin has access to everything, and then your agency who looks after their own client,
> and then a client who can access only their data. What is so complicated? Why are you being
> bounded by all those rules and regulation? just remove it."_

⚠️ **THE CODE IS ALREADY WRITTEN AGAINST THIS ADR RATHER THAN AFTER IT, AND THAT IS RECORDED HERE
RATHER THAN HIDDEN.** Constitution §3.2 wants the ADR first. The owner instructed the architect to
stop asking and build; this document is therefore the decision **record**, not a decision request,
and 🚫 it must not be cited as owner acceptance of anything beyond the sentence above. 🛑 The owner
still accepts or rejects it; a separate PR flips the status with their words verbatim.

Depends on: ADR-0079 (three scopes) · ADR-0082 (the session a platform operator carries) ·
ADR-0083 (a principal that has no organization).
Amends: **ADR-0083's** "this authorizes no platform rendering" limit. Supersedes: nothing.

---

## 1. The defect, in one sentence

A platform operator signed in with correctly-provisioned rows, and the console answered
`/sign-in?refused=scope-not-served` — **the only account type the owner personally holds could not
use the product at all**, and the screen it landed on told them, at the door, that their access is
not served. Nothing was broken. There was simply no screen for a principal that has no organization,
because ADR-0083 authorized the principal's **shape** and explicitly not a **rendering** for it.

## 2. The decision

**A platform operator is ASKED which organization to work in, and their answer is checked against a
closed set the host configured, on every request.**

That is the whole thing. `/platform` lists the organizations this deployment serves, the operator
picks one, the choice is recorded in a cookie, and `requireVerifiedSession` composes an **ordinary
tenant session** from it. Everything downstream is unchanged: the same three fields, the same
`acceptVerifiedSession`, the same `askEntitlement` over `organizationId`, and 🚫 no `isPlatform`
flag anywhere — ADR-0062 D3 stands, admin is never a bypass.

## 3. 🛑 What did NOT change, and why this is not the thing ADR-0082 D4 forbids

D4 forbids an absent organization being **defaulted, coalesced or guessed** — the one-character
`?? sessionLookupOrganizationId()` that would file a platform operator's work under a tenant they
never named, and would look like a working page. That remains forbidden and remains absent:
`issuePlatformSession` still takes no organization, `VerifiedPlatformSession` still has no such
field, and 🚫 the two principal types still do not convert into each other.

What ADR-0085 adds is the third option neither ADR considered: **asking**. An operator who has not
chosen is sent to choose — 🚫 never placed somewhere. An operator whose cookie names an organization
the host never configured is sent to choose again. An unconfigured deployment serves an **empty
list** and admits nobody; 🚫 it does not fall back.

⚠️ **THE COOKIE CARRIES NO AUTHORITY.** It is re-compared against
`organizationsThisConsoleServes()` on every single request, so a forged value names nothing.
`acting-organization-isolation.test.ts` scans `packages/` and `apps/` and fails if a second module
ever reads it — a second reader would be a caller-supplied organization identifier trusted on its
face, which is the one failure this design exists to prevent.

⚠️ **THE CHOICE COOKIE IS `SameSite=Lax`, AND THIS IS 🚫 NOT ADR-0084 OPTION A.** The **session**
cookie stays `Strict`, and a guard in `@age/session-cookie` now asserts that positively rather than
by counting files. `Lax` is correct for a non-credential that must survive the hop out of sign-in;
🚫 it is not authority to relax anything that grants.

## 4. What this does NOT authorize

- 🚫 **No tenant enumeration.** `/platform` renders the host's configured list, 🚫 not a directory
  query. A platform operator listing tenants from a screen is a different decision, unmade.
- 🚫 **No multi-organization deployment.** One host still serves one organization
  (`operator-environment.ts`). The list shape exists so the picker cannot have a default, 🚫 not as
  a step toward many.
- 🚫 **No client scope.** `refused=scope-not-served` from the **callback** (ADR-0083) is untouched
  and still correct: client-scope accounts are not served, and 🚫 that was not bundled into this.
- 🚫 **No auto-submit when the list has one entry.** An automatic choice is a default wearing a
  form, and the operator would never see where they were put.
- 🚫 **No directory re-read on the platform arm.** The gap named in
  `ADR0083_PLATFORM_PRINCIPAL_CHECKPOINT.md` §5 — a revoked platform membership is caught at 8-hour
  expiry, not on the next request — is **unchanged and still open**. ⚠️ It is now slightly more
  consequential, because the principal reaches tenant pages. It remains the owner's decision.

## 5. The browser gate

🛑 **NOT PROVEN UNTIL AN OPERATOR SIGNS IN AND SEES THE PICKER.** Repository tests prove what the
source may reach; CI proves the steps ran. Neither is a browser, and three consecutive defects on
this track passed both and died on the box.
