# ADR-0053 — The client registry and the operator principal

Status: Proposed
Date: 2026-08-01
Relates to: ADR-0009 (the `Client` aggregate, still reserved), ADR-0026 D4 (missing sections are
limitations, never negative evidence), ADR-0046 D5 (RLS is coherence, not authorization) and D7
(no capture writes), ADR-0047 D9 (`clientContext` is not parameterised — **superseded by D5
below**), ADR-0048 (the readiness surface), ADR-0049 D2 (no default parameter), ADR-0050 D5/D7
(the two deferral blockers), ADR-0051, ADR-0052 (**withdrawn, not merged** — see §0.3)

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by the mandate
the user gave on 2026-07-30, quoted verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

Acceptance under that grant is the architect's. It is **not** a claim that the user reviewed each
decision below.

### 0.2 The context that forced it

On 2026-08-01 the user stated the purpose of AGE relative to the systems they are building
alongside it, verbatim in substance: several tools exist — `Rankops` (Google Search Console,
Analytics and more, ready imminently), `ai-website-projects` (where all website creation and
updating happens), `mcp-ads-server` (running live Google and Meta ads for all clients) — and
_"i needed something that governs everything and separate tools dont take indepednrt decision but
share knowledge."_ Two live clients were nominated for all live testing: **vTEST** and
**Doctor at Door**. Execution will be driven by **Claude in the user's terminal**; a SaaS model is
explicitly **later, not now**.

⚠️ This is not a new direction. `AGE_SYSTEM_MAP.md` §1 already reserves the **Execution Layer** for
exactly these systems, and `11_INTEGRATION_CATALOG.md` §2 already classifies them: mcp-ads is a
**Hybrid** integration, RankOps and the website projects are principally **Source** integrations.
What was missing was never the layer. It was the **shared identity** that lets three tools be about
the same business.

### 0.3 ADR-0052 was withdrawn, not merged

ADR-0052 proposed a client-side `/discovery` page that deliberately discarded its output. Its own
dissent 2 accepted that only under an explicit ceiling: **the next slice on this line cannot also be
one that discards its output.** A real client makes the next slice one that must keep its output,
and a terminal-driven operator makes a browser form the wrong surface entirely. It was therefore
**closed before acceptance**, and no code was written from it.

⚠️ **Two things are carried forward from it and are not weakened here:** its D3 statement that
ADR-0050's two blockers were _avoided, not solved_, and its dissent 2 ceiling. This ADR does not
route around those blockers — **D4 and D5 below take them head-on.**

---

## 1. The defect

Three of the four blockers named on 2026-08-01 reduce to one missing fact.

`ClientContext` is a two-field class — `clientId`, `organizationId` — and every reachable surface in
the repo passes the same frozen constant, `demoContext = new ClientContext('client-demo-001',
'org-demo-001')`. `buildContextReadinessReport` does not take a context at all; it **imports**
`demoContext` (ADR-0047 D9).

Consequently:

- Nothing in AGE can be _about_ vTEST. There is no value to pass.
- Nothing in AGE knows that vTEST in AGE, the vTEST client in RankOps, the vTEST customer in Google
  Ads and `ai-website-projects/vtest` are **one business**. That correspondence exists only in the
  operator's head, which is precisely the fragmentation AGE exists to remove.
- `changedBy` on every `FieldVersion` has no honest value, so no real BIF can be produced
  (ADR-0050 D5/D7).

🚫 **The defect is not that AGE lacks authentication.** It is that AGE lacks **identity** —
knowing _which business_ and _who acted_ — and those two have been conflated into "wait for auth"
across four slices. They are separable, and this ADR separates them.

---

## 2. Decisions

### D1 — A new pure package, `@age/client-registry`

It holds `ClientRecord`: the AGE-side identity of a real business, and the **only** place where the
correspondence between AGE and the external systems lives.

```
ClientRecord {
  clientId          // AGE scope id — feeds ClientContext
  organizationId    // AGE scope id — feeds ClientContext
  displayName
  externalRefs      // see D2
}
```

It exports `toClientContext(record): ClientContext`, and nothing else that reaches outward. The
package is **pure**: no `fetch`, no `process.env`, no `node:fs`, no clock, no `@prisma/client`, no
`@age/bif`. It is a lookup, not a loader.

⚠️ **This is not ADR-0009's `Client` aggregate and must not become one.** ADR-0009 stays reserved.
A registry entry carries no lifecycle, no status, no `Draft → Active`, no business attributes — it
answers _"which scope, and what is this business called elsewhere"_ and nothing more. The moment a
field appears on it that a capability would reason over, the wrong thing is being built.

### D2 — AGE holds the mapping. The other systems change nothing.

`externalRefs` maps a system key to that system's own identifier for the business — RankOps' client
record, the Google Ads customer, the Meta ad account, the website project, the GSC property.

The alternative — one shared identifier minted by AGE and adopted by all four systems — is
**REJECTED**. mcp-ads-server is running live spend today and RankOps is mid-build; requiring both to
migrate their identity model so that a system with no reachable surface can be tidy is the wrong
direction of travel. **AGE is the newcomer and therefore AGE absorbs the translation.**

⚠️ The map is **open, not an enum of blessed systems**: keys are validated as non-empty strings, not
checked against a list. New tools will be added, and adding one must not require editing AGE.

### D3 — Real client records are NEVER committed. The repo is public.

`awanishk14/AGE` is a public repository. A committed registry would publish the operator's client
roster and their ad-account and property identifiers.

Therefore the package ships **the shape, the validation and the resolution logic** plus clearly
fictional fixtures used by its own tests. **Concrete records for vTEST and Doctor at Door are
supplied from a local, gitignored source and are not part of the repository.**

🚫 Do not "make the demo more realistic" by committing a real client. 🚫 Do not commit a redacted or
partially-masked one either — a masked ad account id is still an assertion about who the operator's
clients are.

⚠️ **Corollary, and the reason this is a decision rather than hygiene:** a guard test must fail if
the committed fixtures ever stop being obviously fictional. Absence of a real id today is not a
control; the guard is.

### D4 — `OperatorPrincipal`: authorship without authentication

`changedBy` gets an honest value **now**, without an auth build, because there genuinely is one
human operator executing everything from a terminal.

An `OperatorPrincipal` is a branded value of the form `operator:<handle>` — e.g. `operator:awanish`.
It asserts exactly what is true: **a named human operator acted.** It does not assert an
authenticated session, a user account, a role or a permission.

⚠️ **This is the load-bearing distinction, and it is what ADR-0050 D5/D7 were actually protecting.**
Those blockers refused a _fabricated_ principal — a fixed constant pretending to be a user. An
operator principal is not that: it is a smaller true claim, not a smaller lie. The failure mode
being avoided is provenance that says something the system cannot support, and
`operator:awanish` says only what the system can support.

🚫 **It is never defaulted, never optional, and never inferred** (ADR-0049 D2). A caller that cannot
name the operator does not get a generated one — it fails. 🚫 It must never be treated as an
authorization decision, and no code may branch on it to grant or deny anything. It is provenance.

⚠️ When real authentication arrives, an authenticated principal **supersedes** this; it does not
reinterpret history. Rows stamped `operator:awanish` stay true, because they always described an
operator action and never claimed more.

### D5 — `clientContext` becomes a required parameter of the readiness report

This **supersedes ADR-0047 D9**, which recorded that `clientContext` was not parameterised.

`buildContextReadinessReport` stops importing `demoContext` and takes the context as a **required
parameter**, exactly as `producedAt` already is. 🚫 **No default value** (ADR-0049 D2): a default
would make the whole thing unfalsifiable behind a signature that only _looks_ parameterised, which
is worse than the hardwired import because the hardwired import was at least honest.

The demo continues to pass `demoContext` explicitly, and **the demo baseline does not move** —
98/63 intake vs 12/17 BIF, band `'strong'`, 7 populated + 5 omitted. ⚠️ If it moves, something other
than the context plumbing changed and the change is wrong.

### D6 — The surfaces AGE needs are the CLI and package APIs, not screens

The operator drives AGE from a terminal through Claude. A web UI is therefore **not** the path to
reachability and building one first would be building the SaaS before the system.

⚠️ **But the multi-tenant shapes stay.** `ClientContext`, the `Organization → Client → Project`
hierarchy and the RLS policies are already correct and cost nothing to keep. SaaS later means adding
authentication **above** these shapes, not reshaping them. 🚫 No slice may "simplify" the two-field
scope to a single client id, hardcode the organization, or drop the scope parameter because there is
currently one operator. **RLS remains coherence, not authorization** (ADR-0046 D5) — a second tenant
does not change that, and this ADR does not claim otherwise.

### D7 — Each system stays a standalone product. The dependency arrow points one way.

The user has stated the intended end state: once tested, **RankOps and mcp-ads-server each become a
SaaS in their own right _and_ compose into AGE.** Both, not either.

That rules out the two easy integration styles:

- 🚫 **AGE must not absorb them.** No porting RankOps' or mcp-ads' logic into `packages/`. A
  capability that reimplements what mcp-ads already does is a fork, and the fork is the thing that
  drifts.
- 🚫 **They must not grow an AGE-shaped dependency.** No `@age/*` import, no AGE-minted identifier
  in their schemas, no field that only makes sense when AGE is present. A product that cannot run
  without AGE is not a standalone product.

⚠️ **The dependency arrow points from AGE outward and never back.** AGE knows about RankOps;
RankOps does not know about AGE. This is what D2's `externalRefs` buys and is the reason the mapping
lives here rather than there.

⚠️ **This does not conflict with Doc 11 §1.2, and the reading is recorded here so it is not
re-litigated.** Doc 11 says integrations are "not independent modules… never as standalone systems."
That governs **how AGE interprets what arrives** — always through Client and Project context, never
as free-floating system output. It says nothing about whether the system on the other end can exist
without AGE. D7 is the **stronger** form of the same principle: AGE scopes everything it consumes to
a client, _and_ refuses to make the source depend on it.

⚠️ **Doc 15 §2 is a separate matter and is NOT resolved here.** It states that AGE's editions are
"scaling tiers of the same platform, not separate products" — which is about **AGE's own** tiers,
not about composing other products, so it neither authorizes nor forbids D7. Per `START_HERE.md` §4
the Product Bible outranks an ADR, so **an amendment to Doc 15 recording that AGE composes
independently-viable products is required**, and it needs **Product Owner approval** — it is a
product change, not an architectural one, and is therefore outside the §0.1 architect grant.
🚫 Until that amendment lands, do not cite D7 as having changed the Product Bible.

⚠️ **Corollary for every future integration slice:** AGE consumes each system across its **public
product boundary** — the API or interface it would offer any customer — never a private table, a
shared database, or an internal module. If a needed fact is not on that boundary, the fix is to add
it to that product's public surface, not to reach behind it.

### D8 — What this slice does NOT do

🚫 No persistence write of any kind. 🚫 No `produceAndCapture` (ADR-0046 D7 stands). 🚫 No BIF
produced or promoted. 🚫 No RIE adapter, no call to RankOps, mcp-ads or any external system, no URL
fetched. 🚫 No authentication. 🚫 No `Client` aggregate (ADR-0009 stays reserved).

**None of these is authorized by this ADR.** Each needs its own.

### D9 — Guards, each made to fail before being trusted

At minimum: `@age/client-registry` imports neither `@age/bif` nor `@age/persistence` nor
`@prisma/client`; the package contains no `fetch(`, `new Date(`, `Date.now(`, `Math.random(`,
`process.env` or `node:fs`; the committed fixtures are obviously fictional (D3); no default value
reaches `clientContext` or the operator principal (D4, D5); the demo baseline is unchanged (D5).

⚠️ Each guard is evidence only once mutated, confirmed to name the mutation, and restored.

---

## 3. What this deliberately does not claim

- It does **not** make AGE reachable for a real client. It makes a real client **nameable**. The
  slice after this one is what makes it reachable, and conflating the two is the ADR-0050 §3 failure
  this track has already been caught by once.
- It does **not** resolve ADR-0050 D5/D7 by avoidance. D4 answers the `changedBy` blocker directly
  and D5 answers the `demoContext` blocker directly. ⚠️ If either answer is judged wrong, the
  blockers are back — they are not disposed of by this ADR having been written.
- It does **not** authorize reading from or writing to any external system.

---

## 4. Dissents, recorded not dissolved

**Dissent 1 — security and invariants.** An operator principal is a single unauthenticated string
that the system will stamp onto permanent provenance. Nothing verifies it. A typo, or a second
person at the same terminal, produces provenance that is confidently wrong, and provenance is the
one thing AGE refuses to fabricate. **Answer:** upheld as a real limitation, rejected as a blocker.
The claim is scoped to match what can be supported — "an operator acted" — and D4 forbids any
authorization decision from resting on it. ⚠️ Its ceiling: **the first slice that lets a second
person act, or that exposes AGE beyond the operator's terminal, must build authentication first.**

**Dissent 2 — the skeptic.** This is the fifth slice on the discovery track and it still calls no
capability and still produces no output for a real business; a registry with no reader is the same
"constructible is not reachable" defect wearing a different hat. **Answer:** partially upheld, and
the answer is a constraint rather than a rebuttal. D5 gives the registry a reader in this same
slice — the readiness report takes a real context — so it does not ship unreferenced. ⚠️ But the
ceiling stands and is stricter than ADR-0052's: **the next slice must make an actual client's
answers produce an actual stored result. A sixth slice that only adds shape is evidence the track is
avoiding the user rather than serving them.**

**Dissent 3 — sequencing.** RankOps is not finished, so the correct first integration may be
mcp-ads (live and stable) rather than the discovery input path, and this ADR quietly assumes the
input path goes first. **Answer:** accepted as a genuine open question and deliberately left open.
This slice is a precondition for **both** — neither an mcp-ads adapter nor a discovery capture can
be scoped to vTEST without a `ClientRecord`. ⚠️ The order of C (evidence in) versus B (understanding
in) is **not decided here** and must be decided on its own evidence, not inherited from this ADR's
narrative order.
