# ADR-0071 — the peer transport track, checkpoint

> The record for **#325** (ADR-0071 `Proposed`) and **#326** (ADR-0071 `Accepted`).
> Extracted from `CLAUDE.md` §1 on 2026-08-14 so the working-memory file could stay inside its
> budget. ⚠️ **Append, never rewrite.** 🚫 Nothing here authorizes a slice — the ADR does that, and
> it authorizes the **shape only**.

---

## 1. What was merged

| PR   | Merge SHA | What it did                                                              | Post-merge CI                                   |
| ---- | --------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| #325 | `dbe4fd1` | ADR-0071 `Proposed` + the `EI_01` gap-A correction                       | green                                           |
| #326 | `22a6613` | ADR-0071 `Accepted` (§0.1/§0.1a/§0.1b/§0.1c) + `EI_01` gap A/B/C updates | green, **15 steps**, matched by full `head_sha` |

Changed files at #326: `docs/adrs/0071-where-a-peer-presents-itself.md`,
`docs/product/ecosystem-integration/EI_01_TRACK.md`. Docs-only, so the path-gated `ci-db.yml`
correctly did not trigger — 🚫 that is not a skipped gate.

---

## 2. The decision, verbatim in shape

🛑 **ADR-0071 is `Accepted` and was 🚫 NOT self-accepted.** The Product Owner answered §4 in their
own prose rather than by selecting a labelled shape; the answer selects **option 3** by restating
its mechanism.

- **D1** — the V1 outbound projection is **OPERATOR-MEDIATED**, mirroring ADR-0069 D3.
  🚫 No peer credential, principal or session; 🚫 no new `Authentication` arm.
- **D2** — that is a **V1 transport constraint with an expiry condition**, 🚫 not a principle and
  🚫 not the permanent ecosystem architecture.
- **D3** — the authenticated peer protocol is 🛑 **explicitly unresolved, and deferring it IS the
  decision.** It needs its own ADR answering all ten §3 trust questions.
- **D4** — 🛑 **proving the intelligence loop is not completing the peer integration.**
  `peer → operator → AGE → operator → peer` is **rung 5**, 🚫 never rung 6, 🚫 never
  "RankOps integrated".
- **D5** — the projection's shape is unchanged by the transport. ⚠️ Widening the payload
  _"since a human is reading it anyway"_ is a **REFUSAL**.
- 🚫 **MCP auth middleware is refused by name** — it would re-trust every existing tool as a side
  effect.

⚠️ **§0.1a records that the architect's recommendation and the owner's answer agreeing is a fact,
🚫 not independent corroboration** (finding 7). §2 wrote all four shapes, so the owner selected from
a framing that was entirely the architect's. The owner's route to option 3 was their own — an
argument from the **Claude-only constraint** rather than from ADR-0069 D3's symmetry — but that is a
second _reason_, 🚫 not a second _observer_. If §2 omitted the right shape, this acceptance carries
that omission forward.

---

## 3. The three owner clarifications — 🛑 binding, 🚫 not commentary

### 3.1 Sequencing — ADR-0070 D2 comes first

> Resolve ADR-0070 D2 next. I agree this should take priority over the outbound ecosystem slice.
> The reason is strategic: document ingestion is part of AGE's intelligence-building capability,
> whereas outbound peer projection is the final leg of the ecosystem loop.

🛑 **Accepted does not mean next.** ADR-0071 makes the outbound half of ADR-0069 deliverable 7
**buildable, 🚫 not imminent.** The projection has nothing worth carrying to a peer until AGE can
read a real client document — building the transport first would demonstrate a working pipe with
nothing in it.

### 3.2 How the shipped inbound half is described

The owner rejected _"AGE can now receive information from a peer product, reason over it, and show
the result on screen"_ as imprecise, and fixed the wording:

> What is shipped is the AGE-side semantic machinery and operator-mediated relay, not a real
> integration with RankOps. […] The actual status should remain: **AGE can accept a correctly shaped
> observation through its relay mechanism.** It does not mean: RankOps ↔ AGE integration is working.

🛑 **"A peer sent AGE an observation" is 🚫 NEVER said of the shipped relay.** No peer repository
contains AGE code, so no peer has ever sent anything — **an operator presented it.** ⚠️ This is D4
applied to the **inbound** direction, which D4's table did not spell out: 🚫 the non-conflation rule
is not outbound-only.

⚠️ The completion criterion stays permanently on the roadmap (`EI_01` §E2.3 + §E2.4, unchanged):
`RankOps → AGE contract → AGE accepts → AGE relates → AGE derives → AGE displays`, then
`AGE → outbound contract → RankOps`, **with an actual round-trip test against the real RankOps
system.** 🚫 Nothing about this acceptance moves it.

### 3.3 Gaps B and C are not written to complete the documentation

> I agree these are legitimate gaps, but I would not rush to write them merely to make the
> documentation "complete."

Both future ADRs are constrained **in advance**:

- **Gap B — contradiction.** The reportable fact is **"conflicting information exists"**, and it
  🛑 must never become **"AGE has decided the BIF is wrong."** ⚠️ Not every difference is a
  contradiction: a peer reporting a decline in a market the BIF names is **agreement plus new
  information**, 🚫 not a conflict. The ADR must separate the two before deciding anything about the
  second.
- **Gap C — ageing.** 🛑 **Observation age ≠ observation validity.** An observation made in the past
  remains historically true _as an observation_; what age may affect is **currentness** — whether
  AGE should use it when constructing a **current** conclusion. 🚫 An ADR that lets ageing decide
  truth is answering the wrong question.

---

## 4. What is still refused, unchanged by this acceptance

- 🚫 Everything in ADR-0071 §5's "not authorized, by name" list stands.
- §6's revisiting trigger is unchanged: a **real peer adapter that has something to say and no way
  to say it** — 🚫 not a prediction, and 🚫 not the manual step becoming tiresome.
- 🛑 **The Operator 2 account remains a human act**, reaffirmed by the owner:
  _"This is not something Claude should build. If the architecture deliberately says provisioning is
  an out-of-band human action, keep it that way."_ (ADR-0068 §0.1c.)

---

## 5. The owner's order of work (2026-08-14)

🛠️ Follow it; 🚫 do not re-derive one.

1. ✅ Accept ADR-0071. — **done, #326.**
2. 🛠️ **Answer ADR-0070 D2** — the document decoder. Ahead of the outbound slice.
3. Provision **Operator 2 by hand**, by the owner. 🚫 Never a provisioning path.
4. Finish the document/source ingestion capability.
5. The **gap B** (contradiction) ADR, under §3.3's constraint.
6. The **gap C** (ageing/currentness) ADR, under §3.3's constraint.
7. Only then the first **real** ecosystem integration — **RankOps first**: the contract implemented
   on **both** sides, **one real end-to-end round-trip test**, and 🚫 not called complete before
   that test passes. Then the same pattern per peer.

⚠️ **Do not design five separate integration architectures.** The point of the semantic contract is
that every peer plugs into the **same** AGE model. The long-term loop the owner is building toward:
`Business → AGE → shared intelligence → peers → new observations → AGE → refined intelligence`,
with AGE as the common organizational intelligence layer and the peer products remaining
specialized execution systems.
