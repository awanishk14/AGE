# ST_02 — Every screen

Status: **Proposed**. 🚫 Authorizes no code.

Each screen carries: **the question it answers**, a wireframe, its components, its states, and — per
the owner's requirement — **what package / API / runtime / data model provides it, or `GAP` if
nothing does.** 🚫 Where nothing provides it, the screen says `GAP`. It does not invent.

Legend for the dependency block: **Pkg** = package · **API** = HTTP route · **RT** = runtime that
actually computes the value · **Model** = data model. `—` means none exists.

---

## L0 · Login

**Question:** _Who are you?_
**Status: 🛑 BLOCKED — and the block is the honest answer.** ADR-0058 D2: there is no authenticated
principal; the entitlement answer is **"not established"**.

```
┌──────────────────────────────────────────────┐
│                  AGE Studio                  │
│                                              │
│   ○  No authenticated identity               │
│                                              │
│   AGE has no identity system yet. Access to  │
│   this console is limited by the loopback    │
│   bind only (ADR-0057 D2) — it is reachable  │
│   from this machine and no other.            │
│                                              │
│   Loopback is necessary, not sufficient: a   │
│   proxy, tunnel or published container port  │
│   in front of this listener defeats it.      │
│                                              │
│            [ Continue as operator ]          │
└──────────────────────────────────────────────┘
```

🚫 No username field, no password field, no "remember me", no avatar, no initial, no green tick,
🚫 never the words "signed in" or "logged in". The button says **Continue**, because nothing is being
verified. ⚠️ **This screen exists to be honest about a missing subsystem, not to simulate one** — if
it ever reads as a login, it has failed (ADR-0058 D7).

**Pkg** `@age/studio-shell` (the copy) · **API** — · **RT** — · **Model** — · **GAP: the entire
identity subsystem. ADR K.**

---

## S1 · Dashboard

**Question:** _What has AGE learned lately, and what needs me?_

```
┌─ AGE Studio ────────────────────────── ○ no identity · read-only ─┐
│ SYSTEM STATUS                                                     │
│  Identity      ─ not established   (does not exist)               │
│  Discovery     ◐ exists · not wired                               │
│  BIF           ◐ contracts only · no runtime                      │
│  Evidence      ○ contracts only · no runtime                      │
│  Strategy      ○ contracts only · no runtime                      │
│  Runtime       ○ not established                                  │
│  Last onboarding:  Not read — Studio is not connected to the      │
│                    capture store (ADR-0055 D7)                    │
├───────────────────────────────────────────────────────────────────┤
│ BUSINESSES                     │ NEEDS ATTENTION                  │
│  <resolved from the operator's │  — Not assessed —                │
│   record file, or "no record   │  Nothing has been read, so there │
│   file configured">            │  is nothing to be pending.       │
├────────────────────────────────┼──────────────────────────────────┤
│ RECENT INTELLIGENCE            │ RECENT CONTRADICTIONS            │
│  — Not assessed —              │  — Not assessed —                │
└───────────────────────────────────────────────────────────────────┘
```

⚠️ **Every panel on this screen is an aggregate, and an aggregate is the easiest place to lie.**
🚫 An empty "Pending Suggestions" must never render as **0** — zero is a measurement. It renders
**"Not assessed"** with the reason. 🚫 No sparkline, no trend arrow, no "up 12%".

**Pkg** `@age/client-registry` (businesses only) · **API** — · **RT** — · **Model** `ClientRecord` ·
**GAP:** suggestions, intelligence, executions, knowledge updates and contradictions have **no
runtime at all**, not merely no endpoint.

---

## S2 · Businesses

**Question:** _Which businesses does this operator have records for?_
**Status: ✅ BUILDABLE TODAY — the only rich screen that is.**

```
┌─ Businesses ──────────────────────────────────────────────┐
│  Records resolved from the operator's record file.        │
│  Organizations below are derived from those records —     │
│  they are not a place you can navigate to.                │
│                                                           │
│  ORGANIZATION  org_…a41                                   │
│    ▸ <client display name>        ● known                 │
│        clientId  cl_…7f2                                  │
│        Discovery — not assessed   BIF — not assessed      │
│    ▸ <client display name>        ● known                 │
│                                                           │
│  ORGANIZATION  org_…b09                                   │
│    ▸ <client display name>        ● known                 │
└───────────────────────────────────────────────────────────┘
```

🚫 **No "Create client" button** — the console is read-only and a client is created by the operator's
own file. 🚫 The organization band is not clickable, has no count badge implying completeness, and
🚫 never appears with nothing under it. ⚠️ Per-business Discovery/BIF columns read **"Not assessed"**,
not "0%" — nothing has read the capture store.

**Pkg** `@age/client-registry` ✅ · **API** — (reads the operator's file directly, in-process) ·
**RT** — · **Model** `ClientRecord` ✅

---

## S3 · Business Profile

**Question:** _What do we know about this business, and where did each part come from?_

The owner's list — industry, market, goals, competitors, products, target audience, current tools,
current channels — is **exactly the BIF's shape**, and none of it is stored outside a BIF snapshot.
So this screen is a **projection of S5**, not a separate record. 🚫 Do not create a second business
model to fill it; that is how two sources of truth start.

**Pkg** `@age/client-registry` (name + ids only) · **API** — · **RT** — · **Model** `ClientRecord` ✅
for identity, **GAP** for every business attribute — they live in a BIF that has no runtime.

---

## S4 · Discovery

**Question:** _What has this business told us, and what is still missing?_
**Status: ✅ BUILDABLE TODAY (rendering + validation). 🛑 Submission stays DISABLED.**

The questionnaire is real: **9 sections, 17 questions**, with per-question `entryKind` enums.

```
┌─ Discovery ── <business> ─────────────────── 0 of 17 answered ─┐
│ ●───○───○───○───○───○───○───○───○                              │
│ Identity Offerings ICP Market Brand Channels Goals Assets Ev.  │
├────────────────────────────────────────────────────────────────┤
│  SECTION 1 · Business identity                                 │
│                                                                │
│  What is the business called?                          [ required ]
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ⓘ WHY THIS MATTERS                                            │
│    Everything AGE later attributes is attributed to this       │
│    name. It is never inferred from a domain or a document.     │
│                                                                │
│                    [ Submit — disabled ]                       │
│  Submission is disabled. The first real onboarding runs        │
│  through the CLI (ADR-0054 D6). Enabling this button is a      │
│  runtime-caller change and needs its own decision.             │
└────────────────────────────────────────────────────────────────┘
```

⚠️ **"Mock contracts" is read as: the real questionnaire, rendered, with no answers invented.** The
questions are real repo data; only the _answers_ would be fabrication, and 🚫 they are not supplied
(`18_AGE_STUDIO.md` §7.1). 🚫 The progress counter counts **answered**, never "estimated completion".
⚠️ The enum is on the **question** (`entryKind`), never inferred from an answer (ADR-0051).

**Why-this-matters copy is a GAP:** the questionnaire has no `rationale` field. 🚫 Do not write the
rationale in the UI layer — it belongs on the contract, and putting it in a component means the CLI
and the console explain the same question differently.

**Pkg** `@age/business-discovery-contracts` ✅ (`defaultQuestionnaire`, `questionnaire-validation`) ·
**API** — · **RT** CLI only (`apps/capture`) · **Model** `DiscoveryQuestion` / `DiscoveryAnswer` ✅

---

## S5 · Business Intelligence File

**Question:** _What does AGE believe about this business, and how strongly?_

Sections per the owner: Business · Market · Audience · Products · Competitors · Opportunities ·
Risks · Unknowns · Confidence · Evidence. Every statement shows **source, confidence, evidence,
timestamp, status**.

```
┌─ BIF ── <business> ──────────── snapshot: none read ───┐
│  MARKET                                    ◐ partial   │
│   "Primary geography is …"                             │
│     source     Discovery · question mkt-geographies    │
│     confidence 0.62      status  Draft                 │
│     captured   2026-…    evidence  1 item ▸            │
│                                                        │
│  OPPORTUNITIES                          ─ not assessed │
│   AGE has not looked. This is not zero and not empty.  │
│                                                        │
│  UNKNOWNS                                   ○ known-   │
│   AGE looked and found nothing here. This is a         │
│   result, not a failure.                               │
└────────────────────────────────────────────────────────┘
```

⚠️ **The three absences on this screen are different and 🚫 must never share a treatment**: a section
_omitted_ from a partial Draft (a **limitation**, ADR-0026 D4), a section _looked at and empty_ (a
**result**), and a section _not yet assessed_. 🚫 Never placeholder-fill an omitted section.
🚫 `sufficiency` omitted stays undefined — never defaulted to `ready`. 🚫 Never promote BIF status
from the console. ⚠️ `discoveryCompletenessScore` and `bif.completenessScore` are **different
numbers** and must be labelled so they cannot be read as one.

**Pkg** `@age/bif` ⚠️ **types only, 0 functions** · **API** — · **RT** `produceScoredBifContext` in
`@age/business-discovery-contracts` ✅ is the only Discovery→BIF mapping · **Model** `Bif` ✅ ·
🛑 **BLOCKED by ADR-0055 D7** — no snapshot may be read until the operator's own run.

---

## S6 · Evidence Timeline

**Question:** _Everything AGE has learned, when, from where, and how much it is trusted._

Sources the owner named: Discovery · RankOps · Ads · CRM · Manual · Website · Search Console · GA4.
⚠️ **Exactly one of those exists as a producer today: Discovery.** 🚫 The other seven must not appear
as empty rows or greyed filters — an unreachable source rendered as a filter implies data will
arrive. They appear in one honest block: _"Seven further sources are designed and not connected."_

**Pkg** `@age/evidence-contracts` ⚠️ types only · **API** — · **RT** **GAP — no evidence producer
except Discovery** · **Model** `Evidence`, `EvidenceEntityLink` ✅

---

## S7 · Contradictions

**Question:** _Where does AGE believe two incompatible things, and on what evidence each?_

The owner's example — _"Audience is Enterprises"_ vs _"most conversions come from Startups"_ — is the
strongest differentiator in the product and has **no runtime whatsoever**.

```
┌─ Contradiction ─────────────────────────── unresolved ─┐
│  A  "Target audience is enterprises"                   │
│       Discovery · icp-segments · conf 0.7 · 2026-…     │
│  B  "Most conversions come from startups"              │
│       GA4 · conf 0.9 · 2026-…                          │
│                                                        │
│  AGE does not resolve this. It shows both.             │
│  Suggested resolution           ─ not assessed         │
└────────────────────────────────────────────────────────┘
```

🚫 **AGE must never silently pick a winner**, and 🚫 a "suggested resolution" must never be generated
without an engine that can be pointed at. ⚠️ Unknown is never converted into good or bad.

**Pkg** `@age/research-intelligence-engine` ⚠️ types only — it defines `EvidenceConflict` and nothing
computes one · **API** — · **RT** **GAP — the contradiction detector does not exist** · **Model**
`EvidenceConflict` ✅

---

## S8 · Knowledge Graph

**Question:** _How is everything about this business connected?_

Customer → Products → Competitors → Audience → Channels → Campaigns → Keywords → Content → Ads → SEO
→ Conversions. ✅ **The ontology for this already exists** — `@age/business-knowledge-graph` is 56
files of node, relationship and query definitions. 🚫 No Neo4j, no graph store (the owner's answer to
ADR-0057 open question 5): storage stays relational and the relationships are **rendered**.

⚠️ **A graph is the single easiest surface on which to fabricate.** A rendering library will happily
draw an edge that no evidence supports. 🚫 Every edge must carry the evidence that produced it and
🚫 an unsupported edge is not drawn faintly — it is **not drawn**.

**Pkg** `@age/business-knowledge-graph` ⚠️ 56 files, **0 functions** · **API** — · **RT** **GAP — no
graph builder, no traversal, no projection from a BIF** · **Model** ontology ✅

---

## S9 · Strategy

**Question:** _What should this business do, why, and on what evidence?_

Board grouped by SEO · Ads · Content · Website · Social · Email · Automation · Sales. Each card:
confidence, reason, expected impact, dependencies, supporting evidence.

🚫 **Expected impact must never be a fabricated number.** A recommendation with no measured basis
shows **"Not assessed"** in that field and remains a legitimate recommendation. 🚫 No card is ordered
by a score that does not exist.

**Pkg** `@age/strategy-intelligence-engine` ⚠️ 35 files, **0 functions** · **API** — ·
**RT** **GAP — the decision layer is contracts only** · **Model** `DecisionPackage`, `Opportunity`,
`Recommendation` ✅

---

## S10 · Execution

**Question:** _What has been proposed, approved, run, and what happened?_

States: Pending · Approved · Running · Completed · Rejected.

🛑 **This screen is blocked by a deliberate revert, not by a missing package.** PRs #41–#61 removed
the execution layer on purpose, and ADR-0057 open question 3 — _"is execution re-introduced?"_ — is
**OPEN**. 🚫 Do not rebuild `@age/execution-contracts` to fill this screen. ⚠️ The six capabilities do
produce **pending approvals** today (the demo shows six), so a read-only approvals list is the one
honest slice of this screen — and it is read-only in the strong sense: 🚫 **no Approve button.**

**Pkg** `packages/capabilities/*` ✅ (approvals only) · **API** `GET /demo/capabilities` ⚠️ demo scope
only · **RT** `@age/demo-runtime` ✅ read-only · **Model** approval records ✅ · **GAP:** everything
past "pending".

---

## S11 · History & Snapshot Comparison

**Question:** _What changed since last time?_

New · Removed · Changed · Confidence up · Confidence down · Contradictions resolved · New
opportunities.

✅ The storage model is genuinely right for this: snapshots are **immutable append-only**, so a
comparison is always possible and never destructive. ⚠️ **A comparison needs two snapshots and there
are zero.** 🚫 It must not compare a snapshot against a fixture and label the difference "change".

**Pkg** `@age/scored-bif-snapshot-persistence` ✅ has a real repository · **API** — ·
**RT** **GAP — no diff engine** · **Model** `ScoredBifSnapshot` ✅ · 🛑 **BLOCKED by ADR-0055 D7.**

---

## S12 · Peer Products (RankOps · MCP Ads)

**Question:** _What do the peer products say, and where do I go to act on it?_

Read-only widgets. 🚫 AGE never owns RankOps or MCP Ads, never recreates Ads Manager, and consumes
only their public surface. Every widget ends in **Open in RankOps** / **Open in MCP Ads**.

⚠️ **These widgets are the highest-risk surface in the product for a quiet lie**, because a stale
cached number looks exactly like a live one. 🚫 Every value carries **the time it was fetched** and a
value older than its refresh window renders as **stale**, never as current.

**Pkg** `@age/integrations` ⚠️ 16 files, **0 functions**, scaffold only · **API** — ·
**RT** **GAP — no client for either product** · **Model** `IntegrationProvider` ✅ · ⚠️ ADR-0057 open
question 2 — _which peer product is first_ — is **OPEN**.

---

## S13 · Diagnostics

**Question:** _Is AGE itself healthy, and what is it actually made of?_
**Status: ✅ LARGELY BUILDABLE TODAY.**

Operator diagnostics, 🚫 not developer logs: package inventory, capability list and readiness,
identity state, bind host, database reachability, queue state.

⚠️ **This is the one screen that may honestly show a lot**, because its subject is the system itself
— and the system is present. 🚫 It must still not report "healthy" for a subsystem it did not check;
an unchecked subsystem is **"not assessed"**.

**Pkg** `@age/studio-shell` ✅, `packages/capabilities/*` ✅, `@age/capability-kit` ✅ ·
**API** `GET /health` ✅, `GET /demo/capabilities` ✅ · **RT** in-process ✅ · **Model** — ·
**GAP:** queues (none exist), identity (does not exist), logs (no operator log store).
