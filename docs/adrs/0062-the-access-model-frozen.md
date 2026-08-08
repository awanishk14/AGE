# ADR-0062 — The access model, frozen: organization, client, and the admin above them

Status: **Accepted** — by the **Product Owner**, in their own words, on 2026-08-08.
⚠️ **NOT self-accepted.** The architect did not choose this; the Product Owner stated it directly
and instructed that it be frozen. §0.1 carries the instruction verbatim.

⚠️ **THIS ADR FREEZES A MODEL. IT AUTHORIZES NO CODE.** Not a login screen, not a session, not a
role table, not a schema change, not a deployment. It answers a question that was blocking other
decisions; building any of it needs its own `Status: Proposed` ADR.

Date: 2026-08-08
Answers: **ADR-0058 §6 Q1** and **ADR-0061 §2 Q1** (the tenant boundary, previously unanswered).
Relates to: ADR-0061 **§5** (the hosted shape — still open, see §5 below), ADR-0058 **D1** (principal
≠ entitlement ≠ scope), **D2** (the three-valued answer), **D4** (Organizations gets no route),
ADR-0054 **D2** (the scope nobody may type), ADR-0046 **D5** (RLS is coherence, not authorization),
`docs/product/02_WORKSPACE_MODEL.md` §4/§5.

---

## 0.1 Standing — the Product Owner's instruction, verbatim

> _"this is correct and even within an organisation, client can see only their info and not of other
> client and oragnization can see all their client only and not of other orgnisation. and above all
> is a admin who can see the entire hierarchy. what is a rocket science in this. isnt this obvious.
> please freeze this"_

⚠️ **"Freeze this" is the whole instruction.** The model is recorded as decided. 🚫 It is not a
schedule, and 🚫 it is not permission to start building it.

---

## 1. Why this needed stating at all

The model is simple. What was missing was not difficulty — it was a **statement by the person
entitled to make it**.

`docs/product/02_WORKSPACE_MODEL.md:96` already read _"Organization remains the platform tenant
(frozen architecture)"_ and `:130` _"the Organization is the unit of SaaS isolation between
agencies."_ But ADR-0058 §6 Q1 and ADR-0061 §2 Q1 both recorded the boundary as **unanswered**, and
`packages/entitlement/src/entitlement-question.ts:72-74` deliberately carries **both** arms with
neither privileged, guarded by a test asserting they give the **same** answer.

🛑 **That was a real contradiction between the product documents and the architecture decisions**,
and it is the reason this looked unsettled. The code was not being obtuse: guessing a tenant
boundary is how one agency's data reaches another, and the repo chose to hold the question open
rather than settle it by accident in an implementation PR. ⚠️ Doc 02's phrase _"frozen
architecture"_ read as an **inherited assumption**, not a decision taken with the isolation
consequences in view. This ADR converts it into one.

---

## 2. The model — frozen

Four parties. Each sees strictly less than the one above it.

| Party                                     | Sees                                            | Never sees                                                                  |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| **Platform admin**                        | The entire hierarchy, across all organizations. | —                                                                           |
| **Organization** (the agency)             | All of **its own** clients.                     | Any other organization, and any other organization's clients.               |
| **Client** (a business the agency serves) | **Only its own** information.                   | Any other client, including other clients **inside the same organization**. |
| **Nobody authenticated**                  | Nothing.                                        | Everything. (Today's state — see D5.)                                       |

### D1 — The tenant boundary is the **ORGANIZATION**

The unit of SaaS isolation between paying customers is the **organization** — the agency operating
AGE. This answers ADR-0058 §6 Q1 and ADR-0061 §2 Q1. 🚫 It is not the client.

⚠️ **Consequence, stated so it is not discovered later:** `EntitlementSubject`'s two arms
(`packages/entitlement/src/entitlement-question.ts:72-74`) **stop being symmetric**, and the test
pinning them to the same answer becomes a thing that must be **deliberately changed, in the slice
that builds this, with this ADR cited**. 🚫 It must not be quietly deleted as an obstacle. Until
that slice exists, the symmetry test STAYS — it is still true that no code implements a boundary.

### D2 — A client is a **subject of isolation**, not only an object of it

Within one organization, a client sees only its own information. 🛑 **This is new.** Every existing
ADR treats a client as a record the operator reads; nothing in AGE today contemplates a client
**logging in**. Recorded as the Product Owner's model, 🚫 not as an authorized capability.

⚠️ Isolation between clients inside one organization is therefore a **second, inner boundary**, not
a filter applied to the outer one. 🚫 It must never be implemented as "the organization query, minus
some rows" — a filter that is forgotten once returns another client's data to a client.

### D3 — The platform admin is a **real party with real reach**

An admin sees the entire hierarchy across all organizations. 🛑 This is the single most dangerous
role in the product and it is now on the record as intended.

🚫 **The admin is NOT a bypass, a dev-mode, or a default.** ADR-0058 D2's six guards
(`allowAll`, `SYSTEM_PRINCIPAL`, `entitlementOrDefault`, `devMode`, `bypass`, and promoting
`OperatorPrincipal`) stand **unchanged and unweakened** — an admin is an **authenticated identity
that is granted broad scope**, never an unauthenticated caller who is trusted. ⚠️ Whoever builds it
must assume admin actions are the ones an auditor will ask about first.

### D4 — Three levels of visibility, one direction only

Admin ⊃ organization ⊃ client. 🚫 No sideways visibility at any level, and 🚫 no client-to-client
visibility inside an organization. ⚠️ One client's data **never** enriches another's intelligence —
this restates `docs/product/02_WORKSPACE_MODEL.md:88` and is not new.

### D5 — Freezing the model changes **nothing** about today's state

🚫 AGE still has **no authentication**. `askEntitlement` still returns **`not-established`** for
every subject, and that is still **correct** — it means _"nobody has looked"_, which remains true.
⚠️ **`not-established` must never collapse into `denied`** (ADR-0058 D2), and a frozen model is not
an implemented one. 🚫 Nothing here makes identity green anywhere in the UI.

---

## 3. What this ADR does NOT do

🚫 It does not authorize: a login screen · a session · a credential store or identity provider · a
role or permission table · a schema change or migration · RLS changes · a deployment · a hosted
frontend · client-facing access of any kind · an admin console · a caller for `@age/entitlement`.

🚫 It does not answer ADR-0061 **Q2** (what authenticates), **Q3** (the real `granted`/`denied`
arms), **Q4** (where the operator's files live when hosted), **Q5** (ADR-0055 D6's local-database
rule) or **Q6** (the security ceiling). Each remains open in its own words.

🚫 It does not repeal **ADR-0058 D4** — Organizations still gets **no route, no picker, and no
"current organization" in state**, and `REFUSED_AREAS` and its test stay unchanged. ⚠️ Deciding
that the organization is the tenant is **not** deciding that an operator may navigate into one; a
level you can select is a **typed scope**, which ADR-0054 D2 refuses by name. That refusal is
revisited only in the slice that builds identity, under its own ADR.

🚫 It does not make **RLS** an authorization boundary (ADR-0046 D5). RLS `FORCE`s and fails closed
and is a **coherence** constraint. 🛑 It must never be cited as the thing that keeps organizations
apart.

---

## 4. What it unblocks

**ADR-0061 §2 Q1 is now answered.** Per that ADR's §4, the order is Q1 → Q2 → Q3 before any
deployment work, and Q4/Q5 before any real client's data leaves the operator's machine. Q2 is
therefore the next question in that chain — 🚫 whenever the SaaS build starts, which by the Product
Owner's own instruction (ADR-0061 §4) is **not now**.

---

## 5. Still open, and deliberately

**ADR-0061 §5** — is the hosted product **AGE Studio deployed**, or a **peer product** sharing the
packages? ⚠️ A four-lens council on 2026-08-08 split, and its most useful finding was that §5's
stated premise is **false against the code**: the loopback invariant did not shape "every screen"
(three of ~20 `@age/studio-shell` modules are machine-shaped), and the coupling that matters —
naming a file on the operator's disk, ADR-0054 D2 — lives in the **shared** `@age/operator-workspace`
package, so **both options face the same Q4 refactor**. ⚠️ D1 above constrains §5 but does not close
it, and 🚫 §5 must not be closed as a side effect of this ADR.

---

## 6. Open questions raised BY this ADR

1. **Does a client user authenticate against the organization's tenant, or their own?** D2 makes a
   client a logging-in party; that is an identity question ADR-0061 Q2 was not written to cover.
2. **What can a client actually see?** A client seeing "its own information" is not obviously the
   same set the agency sees about it — a BIF carries the agency's assessment of that business,
   including low scores. 🛑 **Unanswered, and it is a product decision, not an access-control one.**
3. **Who creates an admin, and what audits one?** D3 grants cross-organization reach; nothing in AGE
   records who used it.
