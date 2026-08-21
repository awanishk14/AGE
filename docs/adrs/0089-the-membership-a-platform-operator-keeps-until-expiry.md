# ADR-0089 — The membership a platform operator keeps until expiry

Status: **Accepted** (2026-08-21)

🛑 **ACCEPTED BY THE ARCHITECT, 🚫 NOT BY THE OWNER, AND THAT IS THE RULE WORKING RATHER THAN BEING
SKIPPED.** `CLAUDE.md` §5 _Decision rights_ was rewritten on 2026-08-21 on the owner's instruction,
verbatim: _"argue around architect in these kinds of decisions as something for you to take, not
me."_ This decision is internal, reversible in code, and reachable from the accepted ADRs, so it is
mine and 🚫 the owner's signature is not spent on it. §3.3 binds the owner's class only — 🚫 nothing
here provisions a person, changes what the outside world can reach, or judges the business.

⚠️ **THE RECORD STILL EXISTS SO IT CAN BE OVERTURNED.** If the owner disagrees, this ADR is the
thing to point at.

Depends on: ADR-0079 (scope re-read on every request) · ADR-0080 (the fenced platform read) ·
ADR-0082 (the session that belongs to no organization) · ADR-0083 (the platform principal).
Amends: 🚫 nothing. Supersedes: 🚫 nothing.

---

## 1. The gap, stated as it actually is

`requireRequestScope` re-reads the directory on **every** request for a tenant principal, so a
revoked agency or client membership loses its reach on the **next request**. 🛑 **The platform arm
does no such read**, and the code says so in a comment rather than hiding it:

> _"a platform membership revoked mid-session is caught at token expiry, 🚫 not on the next
> request."_

⚠️ **SO THE WINDOW IS UP TO EIGHT HOURS, ON THE WIDEST SCOPE AGE HAS.** ADR-0079 D4 fixed the
session lifetime at eight hours for every scope. A platform operator sees every organization this
console serves; revoking that membership today is a decision that does not take effect until the
session expires. 🚫 That is not a theoretical asymmetry — it is the one place where _"the scope is
read from the database on every request"_ is false, and the falsity is on the widest arm.

## 2. Why the obvious fix is forbidden

`readDirectoryEntryByAccount(organizationId, accountId)` is scoped by organization, and a platform
principal **structurally has none** (ADR-0083 D1 option B). 🛑 **PASSING THE PINNED ORGANIZATION TO
"MAKE THE RE-READ WORK" IS EXACTLY THE SUBSTITUTION ADR-0082 D4 FORBIDS** — a NULL
`organization_id` rendered as a tenant. It would also read the wrong rows: the tenant policies would
return that agency's people, and the platform operator would be re-decided as a member of an
organization they are not in.

## 3. Why the fenced platform read cannot simply be reused

ADR-0080's platform read exists and is fenced — but it is fenced **by the Google-verified address**,
and its own module rules out any other arm, by name:

> _"It runs only after Google has verified an address, and that address is its ONLY input. 🚫 There
> is no arm that takes an account id, and 🚫 no arm that takes nothing."_

The RLS policies behind it expose rows only while `age.platform_sign_in_email` is set. ⚠️ **A
REQUEST DOES NOT HAVE THE ADDRESS.** A verified platform session carries `sessionId` and `accountId`
and nothing else, deliberately. So the re-read needs an identifier the request holds, and the
address is not one.

## 4. The options, and the one taken

- **A — put the email on the session.** 🚫 **Refused.** It makes a person's address a credential
  carried in a cookie's shadow, for the convenience of a read. ⚠️ An address is client data
  (constitution §3.5), and the session row deliberately carries identity, 🚫 not attributes.
- **B — shorten the platform session lifetime.** 🚫 **Refused, and it is 🚫 not mine to take.** Eight
  hours is ADR-0079 D4, the owner's answer, explicitly _"the same for every scope"_. It also shrinks
  the window rather than closing it.
- **C — leave it, and rely on revoking the session row too.** 🚫 **Refused.** It makes correctness
  depend on a human remembering to do two things, and the second one is invisible from the first.
  ⚠️ A guard that is a habit is 🚫 not a guard.
- **D — a second fenced arm, keyed by ACCOUNT ID.** ✅ **TAKEN.** Symmetrical to the address arm in
  every property that made the address arm safe: one identifier the caller already holds, 🚫 no
  enumeration, 🚫 no organization parameter, fails **closed** when the setting is absent, and reads
  the same two tables and no others.

## 5. The decision

**A platform principal's membership is re-read on every request, through a new fenced read keyed by
the account id the session already proved, and re-decided by `decideSignIn` — the same decision,
🚫 not a gentler copy.**

Three things move, and 🚫 nothing else does:

1. **`age.platform_sign_in_account`** — a transaction-local setting and the RLS policies that answer
   to it, mirroring `age.platform_sign_in_email` exactly. ⚠️ **SELECT-only, and `age_app` gains 🚫 no
   new grant** — this widens _which rows a SELECT can see under a setting the request must
   deliberately establish_, and 🚫 nothing else. 🛑 An absent or empty setting reads **nothing**.
2. **`PrismaPlatformAccountRunner` + `platformDirectoryReadByAccount`** — a **separate runner**,
   🚫 not a flag on the address runner, for the reason ADR-0080 already gave: _"a boolean parameter
   meaning 'read without a tenant' is a boolean that can be passed by mistake."_
3. **`decideSignIn(entry, organizationId: string | null)`** — the tenant channel becomes
   **representably absent** rather than faked. ⚠️ **`null` IS 🚫 NOT A DEFAULT AND 🚫 NOT A
   WILDCARD:** with no organization the tenant filter matches nothing and the tenant arm refuses
   `no-membership`; the platform arm never read the parameter at all. 🛑 This is the ADR-0082 D4
   principle applied to a function signature — the absence is expressed, 🚫 never substituted.

## 6. What this does NOT authorize

- 🚫 **No new grant, no write, no INSERT policy, no FORCE RLS change.** `age_app` stays SELECT-only.
- 🚫 **No enumeration arm.** One account id, one entry — 🚫 no list, 🚫 no count, 🚫 no "all platform
  operators".
- 🚫 **No second caller.** The account-keyed read is reachable from the scope door only, pinned by
  full path in a guard, exactly as its address-keyed sibling is pinned to the sign-in door.
- 🚫 **No change to the eight-hour lifetime**, which remains the owner's (ADR-0079 D4).
- 🚫 **No change to what the outside world can reach.** The public surface is untouched.
- ⚠️ It does 🚫 **not fix ADR-0084**. Sign-in still does not work in a browser, and this ADR must
  🚫 not be bundled into that measurement.

## 7. The guards this slice must carry

Each written, then the implementation deliberately mutated so it fails, the failure required to
**name the exact violation**, then reversed by a targeted inverse edit:

- a platform principal whose membership was **revoked since sign-in** → refused on the **next
  request**, 🚫 not at expiry — the case that does not exist today;
- a platform principal whose membership **still stands** → still admitted, so the gate is 🚫 not
  refusing everyone;
- the account-keyed read is called with the **session's** account id, 🚫 never an argument, and 🚫 no
  organization is passed on that arm;
- `decideSignIn(entry, null)` **refuses** a tenant membership rather than admitting one — 🚫 `null`
  is not a wildcard;
- the runner sets its setting **before** any read, and an absent setting reads **nothing**;
- the single-caller guard names the new read by full path.

## 8. What cannot be proven by me

⚠️ **THE RLS HALF IS A HOST FACT, 🚫 NOT A REPOSITORY ONE.** A migration that passes CI has proven
that it parses and applies to a scratch database — 🚫 not that `age_app` reads nothing without the
setting on the deployed box. That is a raw-connection measurement against the running container, and
it is named here so it 🚫 cannot be reported as done because the tests were green.
