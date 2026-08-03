# ADR-0058 — Identity, entitlement, and the scope nobody may type

Status: **Proposed** — 🛑 **a decision request. Do NOT self-accept it.**
Date: 2026-08-03
This is **ADR J** of the J→K→L track the Product Owner opened in ADR-0057 §0.4 open question 6:
_"you are one step away from somebody saying 'can my colleague also log in?' Once that happens, D9
becomes a production problem instead of an architectural note."_
Relates to: ADR-0046 **D5** (RLS is coherence, not authorization) and **D7**, ADR-0053 **D4** (the
operator principal is never defaulted, generated or inferred, and is never an authorization
decision), **D5** (`clientContext` is required), **§2.1 dissent 1** (a second person, or any exposure
beyond the operator's terminal, needs authentication **first**), ADR-0054 **D2/D3** (an operator
file's path is never defaulted; `--organization-id` is refused **by name**), ADR-0055 **D7** (the
operator's own write — 🛑 **undischarged**) and **D9** (the security ceiling: scope is
**caller-asserted**, checked only for self-consistency), ADR-0057 **D2** (OX-INV-1, loopback or
refuse) and **D3** (the console is a precursor surface, never promoted into Doc 07's product).
Product documents: `07_UI_NAVIGATION.md` (Final), `18_AGE_STUDIO.md` §1/§7.1,
`operator-experience/OX_02` §2, `17_DESIGN_SYSTEM.md` §4.

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant (ADR-0043 §0.1, reaffirmed 2026-07-30), and in direct
response to the Product Owner's message of 2026-08-03 re-ordering the work:

> _"1. Identity & Entitlement (ADR J) — Still first. This remains the highest architectural
> priority. 2. Businesses / Organizations — Before Diagnostics. Reason: Without Organizations and
> Clients, the Studio still feels like a shell. The first thing an operator expects is to see and
> manage businesses. The flow should become: Studio → Organizations → Clients → Discovery → BIF →
> Evidence → Strategy. That mirrors how people naturally think."_

🚫 **It is NOT self-accepted and the grant does not stretch to cover it.** The grant is over
decisions the architect can reason to. Three things here are not:

1. **Whether AGE has a tenant boundary at all.** ADR-0046 D5 says RLS is coherence and not
   authorization; ADR-0055 D9 says scope is caller-asserted. Nothing in the repo has ever decided
   what the _authorization_ boundary is going to be. D1–D3 propose one.
2. **Making `organizationId` a first-class concept.** `OX_02` §2 refuses it as a navigation area and
   `18_AGE_STUDIO.md` §1 marks Organizations **V2 only**. The owner's flow puts it above Clients.
   D4 reconciles those, and the reconciliation is a product decision, not a coding one.
3. **Deferring authentication once more.** ADR-0053 dissent 1 made authentication a precondition for
   a second person. D7 states plainly what is still owed and refuses to let a screen discharge it.

⚠️ This ADR is the _shape_ of identity. It authorizes **no code** on acceptance except what D8 names.

### 0.2 The finding that made this urgent, in one paragraph

AGE today can tell you _which_ client a snapshot belongs to and cannot tell you _who is asking_.
`OperatorPrincipal` is passed in by the caller and believed (ADR-0053 D4, ADR-0055 D9); `clientId`
is passed in by the caller and believed; `organizationId` is not passed at all — it is **read off the
resolved `ClientRecord`**, which is the one honest thing in the picture, and it is honest precisely
because nobody may type it (ADR-0054 D2: `--organization-id` is refused **by name**). The system is
safe today for exactly one reason — it runs on one operator's machine behind OX-INV-1 — and that
reason is a **deployment fact, not a property of the software**. The moment a second person exists,
every "caller-asserted" becomes "attacker-asserted".

### 0.3 What this ADR deliberately does not do

🚫 It does not choose an identity **provider**, a session format, a password story or an SSO story.
That is **ADR K**. Choosing a mechanism before the boundary is decided is how the boundary ends up
being whatever the mechanism made easy.

---

## 1. Context

- Studio (#229) exists and is wired to nothing. Every screen says so.
- ADR-0055 D7 is undischarged: no read path until one real business has passed through the shipped
  CLI path. 🚫 A seeded row does not substitute for the operator's own run.
- The standing rule of 2026-08-03: _"For every new backend capability built from now on, there must
  be a corresponding visible place in AGE Studio within the same milestone."_ Identity is a backend
  capability. D6 is its Studio home, and it is due in the same milestone as D1–D3.

---

## 2. Decisions

### D1 — There are three distinct things and AGE has been calling them one

🚫 They must never again be collapsed:

|                 | What it answers              | Today                                    | Where it comes from                                                |
| --------------- | ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| **Principal**   | _Who is acting?_             | `OperatorPrincipal`, **caller-asserted** | The caller. Believed.                                              |
| **Entitlement** | _What may they act on?_      | **Does not exist.**                      | —                                                                  |
| **Scope**       | _What is this record about?_ | `clientId` + `organizationId`            | `clientId` asserted; `organizationId` **derived** from the record. |

**The decision: entitlement is the missing middle, and it is a separate concept from both.** 🚫 A
principal must never be read as an entitlement ("the operator, therefore allowed") and 🚫 a scope
must never be read as an entitlement ("the record says org A, therefore the caller may see org A").
The second is the more tempting error and the more dangerous one: it makes the _data_ grant access
to itself.

### D2 — Until an authenticated principal exists, the entitlement answer is a REFUSAL, not a default

🚫 No `allowAll`, no `SYSTEM_PRINCIPAL`, no `entitlementOrDefault`, no dev-mode bypass — the
`openLocalPrismaCaptureConnection` reason applies unchanged: _the copy that gets relaxed still passes
its own tests_. There is exactly **one** implementation of the entitlement question and while there
is no authenticated principal it returns **"not established"** — a third value, never `true` and
never `false`.

⚠️ **"Not established" is an epistemic state, not an error**, and it maps to `not-assessed` in
`17_DESIGN_SYSTEM.md` §4. AGE has not looked at who you are. That is different from having looked and
found nobody, and 🚫 the two must not share a treatment.

### D3 — Loopback is what stands in for entitlement today, and Studio must say so in those words

OX-INV-1 is the **whole** of the current access control. D3 requires that this be **stated on the
surface**, not just in an ADR: Studio's identity indicator reads _"No authenticated identity. Access
is limited by the loopback bind only (ADR-0057 D2)."_

🚫 It must never render a green tick, a user name, an avatar, an initial, or the word "signed in".
⚠️ 🚫 It must never describe loopback as proving the listener is unreachable — **loopback is
necessary, not sufficient**; a proxy, tunnel or published port defeats it.

### D4 — Organizations is a **scope band**, not a navigation area — and the owner's flow is preserved

The Product Owner's flow is `Studio → Organizations → Clients → Discovery → BIF → Evidence →
Strategy`, and the reasoning — _"that mirrors how people naturally think"_ — is accepted. But
`OX_02` §2 refuses Organizations as an area because `organizationId` has no aggregate, no content,
and **no place where it may be typed**, and `18_AGE_STUDIO.md` §1 marks it V2. Both are right, and
both are about the _same_ danger: a level the operator can navigate _into_ is a level the operator
can **select**, and a selectable scope is a **typed** scope by another name — the exact thing
ADR-0054 D2 refuses by name.

**The decision: Organizations is rendered as a grouping band on the Businesses screen (S2), derived
from the resolved records, and it is not routable.** The operator sees organizations above clients,
reads them top-down, and gets the mental model asked for — while the value stays derived. 🚫 There is
no `/organizations` route, 🚫 no organization picker, 🚫 no "current organization" in state, and 🚫 no
organization that exists without at least one client record producing it. An organization with no
clients is not empty — it is **not a thing**, and must not be rendered as a heading with nothing
under it.

⚠️ This keeps `REFUSED_AREAS` in `@age/studio-shell` unchanged and its test intact. 🚫 Do not add
`organizations` to the navigation model to satisfy the flow — the flow is satisfied by the band.

### D5 — `clientId` selection in Studio is a **filter**, never a grant

Selecting a business in Studio changes what is displayed. 🚫 It must never be the thing that decides
what may be read. When the read path is eventually built (🛑 after ADR-0055 D7), the query is scoped
by the **entitlement answer**, and the selection narrows _within_ that. 🚫 A screen must never issue
a read whose only scope constraint came from a UI selection.

### D6 — The System Status indicator, and the three things it must not claim

The Product Owner asked for a persistent indicator:

> _"AGE Studio / 🟢 Identity / 🟡 Discovery / 🟡 BIF / ⚪ Evidence / ⚪ Strategy / ⚪ Runtime / Last
> onboarding: Never. This immediately communicates: what exists, what is wired, what is intentionally
> unavailable. It reinforces the 'don't lie' philosophy."_

**Accepted, and it is due in the same milestone as D1–D3.** Three corrections, each of which the
"don't lie" philosophy requires:

1. 🚫 **Identity must not be green.** Identity is the one subsystem on that list that does **not**
   exist. Under D2 its state is **"not established"**. A green Identity beside an amber Discovery
   would tell the operator the opposite of the truth.
2. 🚫 **"Last onboarding: Never" must not be shown.** Studio has not read the capture store and
   cannot — ADR-0055 D7 is undischarged. _"Never"_ is a claim about data nobody looked at. It reads
   **"Not read — Studio is not connected to the capture store"** until there is a read path, and
   then it reports what was actually read. ⚠️ This is the same error as defaulting `sufficiency` to
   `ready`: an unlooked-at absence rendered as a measured zero.
3. 🚫 **Colour must not carry the meaning alone** (`17_DESIGN_SYSTEM.md` §4). Every row carries a
   written state and a distinct glyph, and the four states never share a treatment.

⚠️ The indicator reports **two different facts per subsystem and must keep them apart**: _does the
capability exist in AGE_ and _is Studio wired to it_. Discovery exists and is not wired; Identity
does neither. Collapsing them into one lamp is how "🟡" comes to mean two incompatible things.

### D7 — What is still owed before a second person, restated so it cannot be lost

🛑 ADR-0053 dissent 1 stands **unchanged and undischarged**: a second person, or any exposure beyond
the operator's own terminal, requires **authentication first**. 🚫 Neither this ADR, nor a Studio
screen, nor an entitlement type discharges it. D2's "not established" is an **honest placeholder for
a missing subsystem, never a substitute for it** — and if it is ever read as one, this ADR has made
things worse rather than better. That is this ADR's own largest risk (§4).

### D8 — What acceptance authorizes, exhaustively

1. The entitlement question and its three-valued answer, as **types and one pure function** in a
   package, with no caller. 🚫 No middleware, no route guard, no session.
2. The System Status model in `@age/studio-shell` (pure, per D6), and its rendering in `apps/studio`.
3. The Businesses screen (S2) reading `@age/client-registry` **only**, with the D4 band.

🚫 Acceptance authorizes **no** identity provider, **no** session, **no** login screen, **no**
database read, and **no** change to `apps/web`.

---

## 3. Consequences

- Studio can show real businesses in the same milestone as identity's shape, which is what the owner
  asked for, without a database and without discharging D7 by accident.
- Every later access decision has one named place to live, and it starts life refusing.
- The cost: the indicator will show Identity as **not established** for as long as it is true, which
  is a visibly unfinished product. That is the intended reading.

## 4. Risks and the dissent this ADR carries against itself

⚠️ **The strongest argument against D2** is that a three-valued entitlement answer is exactly the
shape a future reviewer will collapse to a boolean under deadline, and that a two-valued answer that
always returns `false` would be harder to weaken. It is rejected because a blanket `false` cannot be
distinguished from a _decided_ denial, and the first thing anyone would add is a bypass to get past
it — which is worse. ⚠️ But the objection is recorded because if D2 ever ships with a default arm,
the objection was right.

⚠️ **The strongest argument against D4** is that a band is a level with the routing removed, and that
a future PR will "just add the route". The guard is the existing `REFUSED_AREAS` test, and it must
not be edited to accommodate a screen.

## 5. Recorded, NOT authorized

⚠️ **This section is not a to-do list** (the ADR-0049 §5 / ADR-0054 §5 precedent — recorded is not
authorized). Each needs its own
`Status: Proposed` ADR: the identity **provider** and session (ADR K) · the entitlement **store**
(who is entitled to what, and who writes it) · multi-operator Studio · anything in `07_UI_NAVIGATION`.

## 6. Open questions for the Product Owner

🛑 **1 — Is the tenant boundary the organization, or the client?** D1 assumes the organization,
because that is what `07_UI_NAVIGATION.md` describes. If the real answer is the client, D4's band is
still correct but the entitlement type changes.

🛑 **2 — Who is the second person, when they arrive?** A colleague of the operator, or a client
seeing their own BIF? They are different products, and the second one makes D5 load-bearing security
rather than hygiene.

🛑 **3 — Does the Discovery UI's "disabled submission" hold indefinitely?** The owner asked for the
Discovery interface built now against real contracts with submission disabled. That is accepted as
sequencing. But 🚫 the button must not become enabled by a later PR without an ADR — enabling it is
the runtime-caller wiring that ADR-0054 §0.1d stopped.

---

## 7. Acceptance

🛑 **This ADR is `Status: Proposed`. It must NOT be self-accepted.** The precedent stands: merge this
PR to record it, the **Product Owner** accepts in their own words, then a **separate** PR flips
`Status` with that note verbatim.
