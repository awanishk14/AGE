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

## 🛑 What AGE is for, and what this track is therefore about

> 🛑 **AGE's purpose is not to collect observations from peer products. AGE is the
> organisation-level intelligence layer.** Collection is a means. ⚠️ A track that measures itself by
> observations received is measuring the means.

🛑 **The onboarding/discovery flow is where the canonical organisation/client context is
established**, and that context is what `age.peer.v1` projects outward. The requirement is therefore
**directional and has an anti-half** (`EI_01` §E0.2):

- Each peer **consumes** the organisation's identity, services, audiences, geographies, priorities
  and constraints from AGE.
- 🚫 **No peer independently reconstructs any of them.** A peer that maintains its own notion of who
  the organisation is has forked the semantic model, and the fork is invisible until the two
  disagree in front of a client.

⚠️ This applies to **every** peer named in this track and to future third parties alike.

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

## Current state (2026-08-15, measured against `main` @ `7e23558`)

| Peer                 | Domain                              | Inbound    | Outbound   |
| -------------------- | ----------------------------------- | ---------- | ---------- |
| **RankOps**          | SEO / search intelligence           | **rung 5** | **rung 5** |
| MCP Ads Server       | advertising intelligence, execution | rung 1     | rung 1     |
| Content Intelligence | content / social strategy           | rung 1     | rung 1     |
| SNARA                | service-business conversational     | rung 1     | rung 1     |
| Humantik             | ecommerce intelligence              | rung 1     | rung 1     |

⚠️ **RankOps crossed rungs 3, 4 and 5 in #333/#334** — its `./core` AGE adapter is real, both
products ran their own real paths, and the exchange completed in both directions. ⚠️ **Rung 5 is the
ceiling of what that proves**, and `EI_01` §E0.1a says why: the round was **operator-mediated end to
end**. 🛑 **Rung 6 is not reachable by any amount of further work on the shipped mechanism** — it is
blocked on ADR-0071 D3's own ADR, and 🚫 a convenience flag is not that ADR. Every derived subject
came back `single-producer`, which is the **correct** outcome and 🚫 is not cross-product
intelligence. Record: `docs/reviews/ADR0071_RANKOPS_ROUND_TRIP_CHECKPOINT.md`.

🛑 **No peer other than RankOps has ever reached rung 3.** No other peer repository contains an AGE
adapter, and none should until its slice is authorized (§ scope rule below).

⚠️ Inbound is rung 1 for the other four because the contract is source-neutral by ADR-0069 D6 — the
shipped surface would accept an observation from any of them without knowing which, but none has
ever presented one. ⚠️ **Source-neutrality is not per-peer progress**, and 🚫 the rung-2 that the
shipped surface confers on AGE must never be reported as a rung the _peer_ has climbed.

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
- 🛑 **Every third-party data source enters through the same AGE semantic boundary.** An observation
  is admitted by attaching to an existing AGE subject, or it is refused (ADR-0069 D4) — 🚫 there is
  no second door for a purchased feed, a subscription, a scraper or a vendor API. ⚠️ **A parallel
  intelligence path is the failure this constraint names**: a source that reaches a conclusion
  without passing the admissibility rules produces intelligence AGE cannot explain, and 🚫 an
  unexplainable conclusion is exactly what the whole architecture refuses to emit.
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
