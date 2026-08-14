# The Ecosystem Integration & Peer Validation Track

> A **program track**, not a Product Bible document. It is where the peer-product integration work
> becomes first-class, named and tracked — including the peer-side code changes AGE cannot make for
> itself.
>
> 🚫 **This track authorizes no code.** Each stage names the ADR it needs, and every ADR is
> `Proposed`-first (§2 of `CLAUDE.md`, standing precedent). 🚫 It does not amend any Final Bible
> document.

## The sentence this track exists to enforce

> 🛑 **AGE ecosystem integration is not complete until AGE and at least one real peer product have
> communicated end-to-end in both directions, with the peer product actually consuming AGE's
> returned intelligence/context.**

Everything else in this track is machinery for making that sentence checkable.

## Why this track exists separately

AGE already contains ecosystem packages, accepted contracts and shipped surfaces. That is a real
achievement and it is **not an integration**. An integration has two sides, and the second side
lives in a repository this program has never touched.

Without this track, AGE-side completeness reads as ecosystem completeness — the same error class the
whole architecture is built to prevent, applied to the program instead of to the data. This document
exists so that "the observation contract is shipped" can never be reported as "RankOps is
integrated."

## The documents

| #   | Stage                                   | Document                             |
| --- | --------------------------------------- | ------------------------------------ |
| 0   | Track index, reporting rule, scope rule | this file                            |
| 1   | The track: E0–E4, contract, proof       | [`EI_01_TRACK.md`](./EI_01_TRACK.md) |

## The reporting ladder (mandatory)

🛑 **These seven states are never collapsed into one status such as "integration done."** When
reporting ecosystem progress, name the rung.

| #   | State                                  | What it means                                                              |
| --- | -------------------------------------- | -------------------------------------------------------------------------- |
| 1   | **AGE contract defined**               | The semantics are decided and recorded in an Accepted ADR                  |
| 2   | **AGE-side implementation exists**     | AGE packages/surfaces implement the contract; nothing external has run     |
| 3   | **Peer adapter exists**                | The peer repository has a real AGE client/adapter                          |
| 4   | **Contract tested with mocks**         | Both sides pass against fixtures — ⚠️ **proves shape, never reachability** |
| 5   | **AGE ↔ peer tested locally**          | Two running implementations exchanged something on one machine             |
| 6   | **AGE ↔ peer communicated end-to-end** | 🛑 The real round trip, both directions, recorded per `EI_01` §E2.4        |
| 7   | **Production-ready integration**       | Rung 6 plus operational readiness; 🚫 not claimed before rung 6            |

⚠️ **Rung 4 is where a program most easily lies to itself.** Mocked contract tests pass when the two
repositories share a shape and nothing else — no transport, no entitlement, no scope, no refusal
path. A rung-4 result must never be reported with the word "working."

⚠️ **A rung is per-peer, per-direction.** "RankOps → AGE at rung 6, AGE → RankOps at rung 3" is a
legitimate and expected report. A single number for a peer is only honest once both directions match.

## Current state (2026-08-14, measured against `main` @ `28f2c95`)

| Peer                 | Domain                              | Inbound | Outbound |
| -------------------- | ----------------------------------- | ------- | -------- |
| **RankOps**          | SEO / search intelligence           | rung 2  | rung 1   |
| MCP Ads Server       | advertising intelligence, execution | rung 1  | rung 1   |
| Content Intelligence | content / social strategy           | rung 1  | rung 1   |
| SNARA                | service-business conversational     | rung 1  | rung 1   |
| Humantik             | ecommerce intelligence              | rung 1  | rung 1   |

🛑 **No peer has ever reached rung 3.** No peer repository contains an AGE adapter, and none should
until its slice is authorized (§ scope rule below).

⚠️ Inbound is rung 2 for every peer because the contract is source-neutral by ADR-0069 D6 — the
shipped surface accepts an observation from any peer without knowing which. Outbound is rung 1
because the projection exists as a pure function with **no surface**, blocked on the transport
decision (`EI_01` §E0, row 14).

## The scope rule (binding)

🚫 **Do not modify RankOps, MCP Ads Server, Content Intelligence, SNARA, Humantik or any other peer
repository now, to "prepare" for AGE.** Specifically forbidden until the corresponding slice is
authorized and the canonical contract is stable:

- speculative AGE hooks · placeholder AGE clients · unused endpoints · fake adapters
- empty integration modules · future-proofing code · duplicated semantic models

⚠️ **"Future compatible" is a named failure mode** (ADR-0066 §0.6, ADR-0068 §0.1c) and it applies to
peer repositories exactly as it applies to AGE. A peer-side module written before its contract is
frozen is a duplicated semantic model with a deployment date.

⚠️ This rule **reserves** the peer-side work; it does not defer it out of the program. E2–E4 track it
explicitly, and the Definition of Done cannot be met without it.

## The constraints this track never relaxes

- 🛑 **AGE must not require an LLM API key. Permanent.** 🚫 No OpenAI / Anthropic / Gemini key, no
  hidden model call, 🚫 **no MCP sampling as an indirect model-key architecture**, no background
  model execution. Claude via CLI/MCP is the intelligence interface, operator-invoked.
- 🛑 **AGE is not a data warehouse.** Data is admitted only when it attaches to an existing AGE
  semantic subject (ADR-0069 D4). Inadmissible data is refused, 🚫 never stored "for later."
- 🛑 **Hub and spoke.** A peer product never talks to another peer product for cross-product
  intelligence (Doc 11 §2.1.1 rule 4). Cross-domain conclusions are AGE reasoning over the shared
  semantic model, or they do not exist.
- 🛑 **AGE is the semantic authority; the peer stays authoritative for its own domain.**
- 🚫 **No new graph database.** BIF and the Business Knowledge Graph are the semantic foundation, and
  ecosystem volume is not an argument for Neo4j.
- 🚫 **No scheduler, no background synchronisation, no generic event bus.**
- 🛑 **Provenance is separate from scoring** (AGE-INV-PROV-1); **incomplete provenance is refused**,
  never downgraded; **inbound proposes, never promotes**; **every inbound surface names its source**;
  **entitlement precedes inbound network access** (ADR-0066 D2/D3/D5/D6/D7).

## Related

- [`../11_INTEGRATION_CATALOG.md`](../11_INTEGRATION_CATALOG.md) §2.1/§2.1.1 — what a peer product is
- [`../15_PRODUCT_ROADMAP.md`](../15_PRODUCT_ROADMAP.md) §5.1 — this track's directional pointer
- `docs/adrs/0066-the-hub-and-the-two-way-claim.md` — the hub, the two-way claim, D1–D7
- `docs/adrs/0069-the-observation-the-conclusion-and-the-relay.md` — the three categories, D1–D7
- `docs/reviews/ADR0069_INTELLIGENCE_LOOP_CHECKPOINT.md` — what shipped, verbatim
