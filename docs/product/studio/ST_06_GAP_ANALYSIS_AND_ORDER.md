# ST_06 — Gap analysis and implementation order

Status: **Proposed**. 🚫 Authorizes no code. ⚠️ **§4 contains decisions that are the Product Owner's,
not the architect's**, and they gate everything after milestone 3.

---

## 1. The four kinds of gap, kept apart

⚠️ They have wildly different costs and 🚫 must never be reported as one number.

| Kind                                                               |     Count | Cost                                        | Examples                                                             |
| ------------------------------------------------------------------ | --------: | ------------------------------------------- | -------------------------------------------------------------------- |
| **A · Missing runtime** — the contract exists, nothing computes it | 5 screens | **Largest by far.** Engines, not endpoints. | Contradiction detector, graph builder, strategy engine, peer clients |
| **B · Blocked by an undischarged precondition**                    | 3 screens | Zero engineering — one operator action      | S3, S5, S11 all wait on ADR-0055 D7                                  |
| **C · Blocked by an open decision**                                |   3 areas | Zero engineering — one owner answer         | Login, execution, organization management                            |
| **D · Genuinely missing plumbing**                                 |   2 items | Small                                       | Questionnaire `rationale` field; a non-demo capability caller        |

⚠️ **Only kind D is ordinary engineering.** The instinct will be to attack A because it is the most
code; the leverage is in B and C, which are answers, not work.

## 2. The gap that matters most, stated plainly

**AGE has designed far more than it has built, and the design is good.** 212 files of ontology,
evidence contracts, decision types and graph definitions exist and are internally coherent. Zero of
them execute. Every screen from the BIF onward is a rendering layer over an engine that was specified
and never written.

⚠️ **This is not a criticism of the sequencing so far** — the contracts are what make the engines
writable and the refusals enforceable. But it means: 🚫 **do not plan the next phase as "wire the UI
to the backend."** For five screens there is no backend to wire to, and a UI built against an absent
engine will grow mock data to have something to render — the exact failure `18_AGE_STUDIO.md` §7.1
forbids.

## 3. Implementation order

Each milestone is shippable, honest on its own, and 🚫 depends on nothing later.

### M1 — Make the shell tell the truth about itself _(no acceptance, no database, no decision)_

1. **System Status indicator** (ADR-0058 D6) — 🚫 Identity never green; 🚫 "Last onboarding" reads
   **"Not read"**, never "Never".
2. **Businesses S2** off `@age/client-registry`, with the derived Organizations band (ADR-0058 D4).
3. **Diagnostics S13** — packages, capabilities, readiness, bind host.
4. ⚠️ **The route migration** from the flat `/bif` shape to `/b/[clientId]/…` (`ST_01` §2). 🚫 Doing
   this after four screens exist costs several times more than doing it now.

### M2 — Discovery, rendered honestly _(no acceptance; needs one contract change)_

5. Add `rationale` to `DiscoveryQuestion` — 🚫 the "why this matters" copy belongs on the contract,
   never in a component, or the CLI and the console explain the same question differently.
6. **Discovery S4** — 9 sections, 17 questions, real validation, progress counting **answered**,
   🛑 submission **disabled** with the reason on screen.

### M3 — The operator's own onboarding run _(not the architect's)_

7. 🛑 The ADR-0054 D6/D7 run. **This is the pivot of the entire roadmap:** it converts S3, S5 and S11
   from blocked to buildable and is the only thing that can. 🚫 A seeded row does not substitute.

### M4 — The read path _(after M3, and only after)_

8. Snapshot read + **BIF viewer S5** with full provenance — the product's core value proposition.
9. **Evidence Timeline S6** over Discovery-sourced evidence only; 🚫 the seven unconnected sources
   appear as one honest block, never as greyed filters.
10. **Business Profile S3** as a projection of S5. 🚫 Not a second business model.

### M5 — The first real engine

11. **The contradiction detector.** ⚠️ Chosen deliberately over the graph and the strategy board: it
    is the differentiator, it needs only evidence (which M4 provides), and 🚫 it cannot be faked in a
    UI rule. **Contradictions S7.**

### M6 — Graph, then strategy

12. **BIF→graph projection + Knowledge Graph S8.** 🚫 Every edge carries its evidence; an unsupported
    edge is **not drawn**, not drawn faintly.
13. **Strategy engine + board S9.** 🚫 Expected impact is "Not assessed" unless measured.

### M7 — Peer products, and comparison

14. **RankOps or MCP Ads widget** — 🛑 which one first is ADR-0057 open question 2, **OPEN**. Every
    value carries its fetch time and a stale state.
15. **Snapshot diff + History S11** — needs two real snapshots, so it cannot precede a second run.

🛑 **Execution S10 is not in this order.** It is a reverted layer behind an open question.

## 4. The decisions this design set cannot make

🛑 **These are the Product Owner's. Every one of them gates work above, and 🚫 none may be resolved by
building a screen that assumes an answer.**

1. **Does the console stay read-only?** You answered _"strictly READ-ONLY"_ on 2026-08-03, and the
   journey you have now described opens with **create organization → invite members → create client →
   submit discovery** — four writes. ⚠️ Both cannot be true. The read-only answer is what currently
   makes "no authentication yet" coherent (ADR-0057 D2's whole argument), so 🚫 relaxing it is not a
   small change: it makes authentication a precondition rather than a deferral (ADR-0053 dissent 1).
2. **Is the tenant boundary the organization or the client?** ADR-0058 §6 q1. It changes the
   entitlement type and the shape of every scoped read.
3. **Is execution re-introduced?** ADR-0057 q3. Screen S10 does not exist as a product until this is
   answered.
4. **Which peer product is first?** ADR-0057 q2.
5. **Which engine is written first?** M5 proposes the contradiction detector. ⚠️ The alternative case
   for the strategy engine is real — it is what a client pays for. The case against is that a strategy
   over unvalidated beliefs is precisely the confident falsehood AGE exists to refuse, and the
   contradiction detector is what makes the beliefs trustworthy. 🚫 This is recorded as a
   recommendation with its dissent, not as a settled matter.

## 5. What this set deliberately did not do

🚫 No Figma, no colour tokens, no typographic scale — `17_DESIGN_SYSTEM.md` owns those and 🚫 a second
source would drift. 🚫 No component API signatures — that is implementation and belongs in the PR that
builds it. 🚫 No estimates: with five engines unwritten, any number here would be the fabrication this
document spends six files refusing.
