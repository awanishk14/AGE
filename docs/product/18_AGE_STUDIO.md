# 18 — AGE Studio

> **Status: Proposed** · Product Bible document · Date: 2026-08-03
>
> Commissioned by the Product Owner, 2026-08-03, who corrected the architect's framing:
> _"Claude is treating the Operator Console as a feature that starts after all ADRs are accepted. I
> would treat it differently. The Operator Console is the product. Everything else exists to support
> it."_
>
> 🚫 **This document authorizes no code.** It is a product frame. Every screen it names is still
> gated by **ADR-0057**, which is `Proposed`.

---

## 0. The correction this document records

The architect's working model was a dependency chain: architecture → ADRs → console. The Product
Owner's model is a dependency **inversion**:

```
                          AGE Studio
                               │
        ┌──────────────┬───────┴───────┬──────────────┐
        │              │               │              │
    Discovery         BIF           Runtime      Peer Products
        │              │               │              │
     Evidence      Strategy        Execution       Outcomes
```

⚠️ **The Studio is not another module. It is the thing a customer buys.** Discovery, the BIF,
evidence, strategy, the runtime and the peer products exist to fill it. A capability that nothing in
the Studio can render is, from the customer's position, indistinguishable from a capability that does
not exist.

### 0.1 What this changes, and what it does not

✅ **Changes:** prioritisation, sequencing, and the language used about the console. The Studio leads;
backend work is justified by what it lets the Studio show.

🚫 **Does not change:** any accepted ADR, any hard boundary, any shipped refusal, or the governance
rule that a `Status: Proposed` ADR is a decision request. ⚠️ **Reprioritising is not authorising.**
Calling the console "the product" does not let it be built before ADR-0057 is `Accepted`.

---

## 1. AGE Studio was already specified — under other names

⚠️ **The most important fact in this document: the Studio is not a new product concept.** It has been
written down since the original Product Bibles. What has never existed is a path from the CLI to it.

| The Product Owner's workspace | Already specified in                                  | Operator-Experience screen |
| ----------------------------- | ----------------------------------------------------- | -------------------------- |
| Dashboard                     | `07_UI_NAVIGATION.md` §5 (dashboards as entry points) | **S1** Console Home        |
| Clients                       | `03_CLIENT_LIFECYCLE.md`, `02_WORKSPACE_MODEL.md`     | **S2** Businesses          |
| Discovery                     | ADR-0049/0050/0051, `@age/business-discovery`         | **S4** Discovery           |
| Business Intelligence         | `@age/bif`, ADR-0026                                  | **S5** BIF                 |
| Evidence                      | ADR-0056 (D3–D7 stand)                                | **S6** Evidence            |
| Strategies                    | `12_EXECUTION_MODEL.md`, the six capabilities         | **S9** Strategy            |
| Approvals                     | `12_EXECUTION_MODEL.md`, `06_PERMISSION_MODEL.md`     | **S10** Execution          |
| Execution                     | `12_EXECUTION_MODEL.md`, `11_INTEGRATION_CATALOG.md`  | **S10 / S12**              |
| Insights                      | ADR-0027 readiness, the capability outputs            | **S8** Intelligence        |
| Timeline                      | The immutable append-only snapshot chain              | **S11** History            |
| Knowledge                     | `04_AI_AGENT_ARCHITECTURE.md` (BKG)                   | 🚫 no screen — see §4      |
| Settings                      | `14_CONFIGURATION_MODEL.md`                           | **S13** Diagnostics (V1)   |
| _(not in the list)_           | Where AGE disagrees with itself                       | **S7** Contradictions      |

⚠️ **S7 has no counterpart in the twelve.** That is not an oversight in the Product Owner's list — it
is the workspace no comparable product has, and the one that most distinguishes AGE. It stays.

**Conclusion:** 🚫 **Do not write a new information architecture.** `07_UI_NAVIGATION.md` is Final and
Product-Owner-approved; `OX_02_UX_ARCHITECTURE.md` is its single-operator narrowing. The Studio is
those two documents, built.

---

## 2. The Studio has two versions, and the line between them is trust

The Product Owner has stated both of the following, on the same day, and **both are correct**:

> _"Version 1 of the Operator Console should be: ✅ View ✅ Browse ✅ Inspect ✅ Understand ❌ Modify
> ❌ Execute ❌ Approve ❌ Delete."_

> _"Login → Create Organisation → Invite Team → Answer Discovery → … → Approve Suggestions → Run
> Actions → Measure Outcomes."_

They are not in conflict. They are **V1 and V2**, and the boundary between them is not a feature
boundary — it is the point at which AGE stops being able to name who acted.

|             | **Studio V1 — the honest mirror**                                            | **Studio V2 — the workspace**                             |
| ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| Trust model | One operator, one machine, loopback only                                     | Multiple people, multiple organisations, networked        |
| Actions     | **Read only**                                                                | Author · approve · execute                                |
| Identity    | 🚫 None. `OperatorPrincipal` is a **label**, never an authorization decision | Authenticated, entitled, attributed                       |
| Gate        | **ADR-0057** (`Proposed`)                                                    | **ADR J → K → L** (entitlement), 🚫 none written yet      |
| Proves      | That AGE can represent its own thinking without lying                        | That AGE can be operated by someone other than its author |

⚠️ **V1 is not a lesser Studio. It is the only version that can be built before identity exists**, and
it answers the question the Product Owner actually asked — _"where are we seeing those intelligence"_.

🚫 **V2 may not be reached by increments.** No V1 screen grows a write. A write needs a new ADR, and
that ADR is blocked on entitlement, not on UI effort.

---

## 3. Sequence — and the one place the Product Owner's own ordering must be corrected

The Product Owner's recommended order ends with _"Identity & SaaS entitlement before exposing it to
multiple organizations."_ ⚠️ **Identity cannot be last.** Three reasons, in ascending severity:

1. **Their own journey opens with it.** `Login → Create Organisation → Invite Team` are steps 1–3.
2. **`07_UI_NAVIGATION.md` principle 4 is permission-aware visibility** — a user discovers only what
   they may access. That is not a late refinement; it determines what every screen queries.
3. 🛑 **ADR-0055 D9: scope is asserted by the caller and checked only for self-consistency.** RLS
   `FORCE`s and fails closed, but it proves a row agrees with **its own declared scope** — it never
   proves the caller is entitled to that scope. ⚠️ **RLS is a coherence constraint, NOT an
   authorization boundary** (ADR-0046 D5). Today one operator on one machine contains this. The
   moment a second person can log in, it is a live data-isolation defect between paying customers.

⚠️ **Read-only does not discharge it.** A console that cannot write can still _read_ another tenant's
snapshots. Read-only lowers blast radius; it does not remove the defect.

This is also what the Product Owner instructed on 2026-08-03: _"Start entitlement (J → K → L) in
parallel. I agree… I would not postpone entitlement until after the UI."_ The corrected order simply
honours that instruction:

| #   | Track                                         | Status                                                                            |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Studio information architecture               | ✅ Done — `07`, `OX_02`, `17_DESIGN_SYSTEM.md`, this doc                          |
| 2   | **Identity & entitlement (ADR J → K → L)**    | 🚫 Not started. **Authorized to begin as `Proposed` ADRs**, in parallel, from now |
| 3   | Frontend skeleton, no backend change          | 🛑 Blocked on **ADR-0057**                                                        |
| 4   | Discovery UI — same schema, rendered as forms | 🛑 ADR-0057 · ⚠️ read-only in V1                                                  |
| 5   | Business Intelligence UI (BIF visualization)  | 🛑 ADR-0057 · ⚠️ **and ADR-0055 D7**                                              |
| 6   | Evidence Explorer                             | 🛑 ADR-0057 · ADR-0055 D7                                                         |
| 7   | Strategy Center                               | 🛑 ADR-0057 · ⚠️ read-only; approval is V2                                        |
| 8   | Execution Center (RankOps, MCP Ads, …)        | 🛑 ADR-0057 · **ADR H is deferred by the freeze**                                 |

⚠️ **Track 2 moved from #8 to #2. Every other item keeps the Product Owner's order.**

### 3.1 The one gate that no reprioritisation removes

🛑 **ADR-0055 D7 still stands: no read path until one real business has passed through the shipped
path.** The Product Owner reaffirmed it on the same day they commissioned this document — _"That rule
has protected the architecture over and over. Don't weaken it now."_

🚫 **Do not seed a row to unblock Studio development.** Tracks 3 and 4 do not need it — they read the
operator's record and answer files. Tracks 5 onward do.

---

## 4. JSON becomes an implementation detail — with one exception

✅ **Adopted:** _"That entire journey should happen without the customer ever thinking about JSON
files. The JSON format can remain internally… but it should become an implementation detail."_

JSON stays as the deterministic wire and import/export format. It stops being the authoring surface.
Rendering the same schema as forms changes **no validation and no semantics** — ADR-0051's
`entryKind` enum lives on the _question_, so a form and a file produce the same profile.

🛑 **The exception, and it is not negotiable today:** the **first** real onboarding runs through
`age-capture onboard` (ADR-0054 D6's five conditions). A form cannot substitute for it, because the
point of D7 is that the _shipped path_ has been exercised, not that a row exists.

---

## 5. Knowledge graphs — agreed, and the freeze already anticipated it

✅ **Adopted:** _"I don't think AGE should become a graph database product… You need graph
thinking."_

The BIF, its evidence links, the strategies derived from it and the snapshots that record its
movement already form the graph. A graph **store** would add an engine and remove no ambiguity.

- **Storage stays relational.** 🚫 No Neo4j, no graph database, no triple store.
- **Presentation may be a graph** — `Mission → supports → Strategy → implemented by → RankOps →
produced → Traffic → changed → Confidence` is a rendering of relationships AGE already holds.
- **ADR I (knowledge graph) remains ⏸️ DEFERRED** by the architecture freeze. That deferral is now
  correct for a second, better reason: it was never the missing piece.

⚠️ **"Knowledge" is therefore not a V1 workspace.** It is a _view_ over existing relations, and it
must obey `17_DESIGN_SYSTEM.md` §4 — 🚫 a graph edge that does not exist may never be drawn as a
faint one, and an unknown node is labelled **"Not known"**, never rendered as an empty circle.

---

## 6. What this document does not decide

- 🚫 **Whether the console exists at all** — that is **ADR-0057**, `Proposed`, awaiting the Product
  Owner. ⚠️ Endorsement is not acceptance.
- 🚫 **The product's name.** "AGE Studio" is used here as the Product Owner's term for the whole
  surface. The single-operator V1 keeps the name **Operator Console** in `docs/product/operator-experience/`,
  because ADR-0057 D3 forbids promoting that document set into the multi-tenant product.
- 🚫 **How entitlement works** — ADR J. This document only fixes **when**: now, in parallel.
- 🚫 **Any screen's implementation** — `OX_03` (data contracts), `OX_04` (capability map),
  `17_DESIGN_SYSTEM.md` (appearance and behaviour) already own those.

---

## 7. The standing frame

⚠️ Whenever a track competes for effort, ask: **what can the operator see afterwards that they could
not see before?** If the answer is "nothing", the track is backend refinement, and the architecture
freeze already says it waits.

🛑 **But the inverse is not a licence.** A screen the customer would love, built before its ADR is
accepted or before entitlement exists, is exactly the failure this project has avoided for
fifty-seven ADRs.
