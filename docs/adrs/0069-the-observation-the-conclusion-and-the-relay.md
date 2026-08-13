# ADR-0069 — The observation, the conclusion, and the relay

Status: **Accepted** (2026-08-13) — see §0.1. 🚫 **NOT self-accepted.**
⚠️ It authorizes **one vertical slice**, 🚫 not a programme.

Depends on: ADR-0066 (D1, D5, D6, D7), ADR-0062 D3, ADR-0058 D2, ADR-0055 §5, ADR-0046 D5,
ADR-0026 D4, AGE-INV-PROV-1.
Supersedes: nothing. Companion: `docs/architecture/AGE_ECOSYSTEM_IMPLEMENTATION_MAP.md` §4–§5.
⚠️ **Both companion documents are deliberately UNTRACKED and 🚫 must never be committed** — each
names a live client in prose, which is client data (ADR-0065 D1). This ADR therefore restates every
finding it depends on, and 🚫 does not require the reader to open them.

---

## 0.1 The Product Owner's answer (2026-08-13)

⚠️ **This ADR was 🚫 NOT self-accepted.** `AGE_ECOSYSTEM_IMPLEMENTATION_MAP.md` §5 stopped and
reported three decisions (D-1 who authors a conclusion · D-2 an operator's standing toward one ·
D-3 inbound transport). The Product Owner answered all three in one instruction. ⚠️ The answer is
recorded **verbatim**, 🚫 not paraphrased:

> **implementation-first requirement: do not create a large series of speculative ADRs. ADR-0069
> should only be drafted if the three currently unresolved questions genuinely require a decision
> before implementation … If a question can be answered by implementing the smallest truthful
> slice and observing what the system actually needs, do that instead.**

> **Do not assume yet that Derived Intelligence must be a permanent persisted entity. Before
> creating that domain model, investigate whether the first real use case requires: persisted
> conclusions, computed projections, or a hybrid … Do not decide this merely because it looks
> architecturally elegant.**

> **Transport constraint: do not build a network ingestion endpoint just because RankOps is a
> separate application … For the first proof, use an explicit operator-mediated mechanism that does
> not violate ADR-0066 D7 and does not introduce a listener or scheduler. Treat server-to-server
> transport as a later architectural boundary that must be justified by actual need.**

> **Use two producers deliberately. A conclusion derived from one source is merely that source's
> observation restated.**

### 0.1a What this decides

**D1 — A conclusion is authored by a deterministic rule, and by nothing else, in this slice.**
Option (b) from §5 — _an operator reasoning in Claude and recording the conclusion as AGE's_ — is
🚫 **REFUSED BY NAME** here. ⚠️ Not deferred as unimportant: refused because it makes a human
judgement wear AGE's name, and 🛑 **the difference is invisible once stored.** Reopening it requires
its own ADR and its own provenance field.

**D2 — Derived Intelligence is a COMPUTED PROJECTION, not a persisted entity.** The observations and
their association to BIF subjects are persisted; 🛑 **the conclusion is recomputed on every read from
persisted inputs + a versioned rule.** This is the "hybrid" of the owner's three options, resolved by
what the first use case actually needs — 🚫 not by elegance. Its consequences are the point:

- ⚠️ A conclusion **cannot go stale**, because there is nothing stored to go stale.
- ⚠️ A conclusion **cannot silently disagree with its inputs**, because it has no independent
  existence to disagree from.
- 🛑 **Therefore D-2 (an operator's standing toward a conclusion — accept / dismiss / ageing) does
  not arise in this slice and is 🚫 NOT decided here.** There is no row to accept or dismiss. It
  becomes a real question the moment a conclusion is persisted, 🚫 and not before.
- 🚫 Do not add a `DerivedIntelligence` Prisma model, a cache, a materialised view or a
  `dismissedAt`. Each is the persisted entity arriving without an ADR.

**D3 — Inbound transport is operator-mediated relay through the existing MCP surface.**
🛑 **No listener. No scheduler. No polling. No background sync. No HTTP ingest route.** The operator
relays a semantic observation; 🚫 the peer product does not connect to AGE. ⚠️ **This does not scale
to a live peer product and must never be described as if it does** — it is honest for one or two
observations, and a networked ingest endpoint is a materially larger crossing (D7 at a network
boundary, source authentication, deployment) that 🚫 this ADR does not authorize. 🛑 **The slice must
not quietly become it.**

**D4 — Admissibility is by SUBJECT, and it is the whole size limit.** An observation is admissible
only if it names a subject AGE already models. 🚫 There is no row cap, no rate limit and no per-vendor
rule; the contract makes the good behaviour the only expressible behaviour. An observation naming
nothing AGE models is either **refused**, or — for the one deliberate case, unmapped demand —
admitted as **explicitly unmapped**, which is 🛑 how AGE learns its own model is incomplete, 🚫 never
a silent coercion into the nearest known subject.

**D5 — Source arrival is never confirmation.** A recorded observation is a **candidate**: 🚫 no BIF
field moves, 🚫 no score moves, 🚫 no status is promoted, ever, by an inbound observation.
⚠️ AGE-INV-PROV-1 holds unchanged — **provenance alone never changes a score.**

**D6 — The contract is source-neutral.** `sourceSystem` is data, 🚫 never a branch. 🛑 **No `if
(sourceSystem === 'rankops')` anywhere in the core.** A sixth peer product is an entry in a registry
and a set of observation types — 🚫 never a new pattern, a new epistemic category or a new screen.

**D7 — Two producers, or the demonstration does not count.** A conclusion drawn from one source is
that source's observation restated. 🛑 **The slice is only honestly demonstrated when the conclusion
depends on two systems that never spoke to each other**, and 🚫 peer products still never exchange
intelligence directly.

### 0.1b What is REFUSED BY NAME by this acceptance

🚫 Any HTTP/network ingestion route, listener, webhook, callback URL or long-poll ·
🚫 any scheduler, cron, queue, event bus, background sync or retry daemon ·
🚫 Neo4j or any graph database (ADR-0066 §0.3d stands) · 🚫 Kafka, Redis, Airflow ·
🚫 any LLM provider abstraction, API key, credential field or MCP **sampling** — 🛑 AGE is an MCP
_server_; it never calls a model · 🚫 any peer-to-peer path between two peer products ·
🚫 a persisted `DerivedIntelligence` row (D2) · 🚫 an operator verdict on a conclusion (D2) ·
🚫 raw-corpus ingestion of any kind — keyword rows, rank positions, spend ledgers, creatives,
post-level analytics, follower counts, and 🛑 **for SNARA: any transcript, quotation or identifiable
individual — aggregate only** · 🚫 any outbound write to any external system (ADR-0066 D1) ·
🚫 any seeded, fixture or fabricated observation presented as a real business's data.

### 0.1c What was NOT decided, and stays open

- 🛑 **Operator standing toward a conclusion, and ageing** (former D-2) — does not arise under D2
  above. ⚠️ It returns the moment persistence is proposed.
- 🛑 **Networked server-to-server transport** — must be justified by **actual observed need**,
  🚫 not by a prediction that relay will not scale (finding 11).
- **Option (b) authorship** — an operator-authored conclusion recorded as AGE's (D1).
- The SNARA aggregate boundary, named precisely, before SNARA integrates.

---

## 1. Context

`AGE_ECOSYSTEM_INTELLIGENCE_ARCHITECTURE.md` established AGE as the semantic hub and
`AGE_ECOSYSTEM_IMPLEMENTATION_MAP.md` audited `main` @ `9d6519a` against it. The finding: the
epistemic core is built and honest, and the ecosystem half does not exist at all. Three things need
inventing — **SourceObservation**, **Derived Intelligence**, **outbound context projection** — and
everything else is wiring what already exists. Nothing needs undoing.

AGE already distinguishes what the business _says_ (BIF) from what is _evidenced_ (Evidence).
It has no category for **what an external system observed**, and none for **what AGE concludes by
relating several pieces of context**. Those are the two gaps this ADR closes.

## 2. The three categories, kept apart

| Category                 | Answers                                             | Authored by                            | Persisted             |
| ------------------------ | --------------------------------------------------- | -------------------------------------- | --------------------- |
| **BIF**                  | What the business says / what the business model is | The business, via intake               | ✅ yes                |
| **Source Observation**   | What an external system actually observed           | A peer product, relayed by an operator | ✅ yes, append-only   |
| **Derived Intelligence** | What AGE concludes by relating the above            | 🛑 A deterministic rule (D1)           | 🚫 no — computed (D2) |

🛑 **These three are never merged, never defaulted into one another, and are never rendered in a way
that lets a reader mistake one for another.** A Studio surface showing a conclusion must show its
contributing observations and their sources, or it is asserting knowledge it cannot support.

## 3. The envelope, and the projection

**Every observation is the same five-part statement** (source-neutral, D6):

```
  subject      -- a service / audience / geography / priority AGE already models   (D4)
+ claim        -- direction (up | down | flat | absent) + materiality band
+ period       -- observedAt, and the window observed
+ provenance   -- sourceSystem, sourceInstance, sourceRecordId, organizationScope  (ADR-0066 D6)
+ claimKind    -- raw-observation | source-derived-intelligence                    (ADR-0066 D5)
```

🚫 Bands and directions, never a vendor's raw metric. **Every outbound projection is the same seven
parts** — identity+scope · language · priorities · constraints · the peer's own recent observations ·
derived intelligence relevant to its domain · 🛑 **unresolved: what AGE does NOT know, named, never
blank and never zero.**

🚫 **No projection ever contains an instruction.** AGE informs; the peer product decides.

## 4. Honesty requirements on every new surface

- 🛑 **Before any real observation exists, every new surface renders `not-assessed` with its
  reason.** 🚫 Not empty, not zero, not "no issues found". The slice ships **visibly empty** before
  it ships populated, and the empty state is the one that must tell the truth.
- 🛑 **"Did not run" and "ran and found nothing" are DIFFERENT STATES and are rendered
  differently** — the `detectContradictions` trap: over an empty list it returns an empty set,
  which reads as a clean bill of health.
- A denial **raises** and 🚫 never returns `[]`; the error carries the answer so `denied` and
  `not-established` stay distinguishable (ADR-0058 D2), and names a **position** — 🚫 never the
  tenant, the digest, the record contents or another client's id.
- Stored rows are **untrusted input**, re-validated on read; the normalizer 🚫 defaults, generates
  and infers nothing.
- Append-only, matching the shipped snapshot discipline: 🚫 no `update`/`delete`/`upsert`, 🚫 no
  `DEFAULT`/`now()`/`@default`/`@updatedAt`, 🚫 no `role`/`scopes`/`claims` (ADR-0062 D3),
  `GRANT SELECT, INSERT` only.
- Entitlement is asked **before acceptance** — 🚫 not after buffering, parsing or queuing.

## 5. Consequences

**Accepted willingly:** the relay is manual and does not scale (D3) — the scaling answer is a later,
larger crossing that must be earned. Deterministic rules are far less capable than an operator
reasoning in Claude (D1) — capability is traded for the ability to say who concluded what.
Recomputing conclusions costs work on every read (D2) — bought in exchange for a class of staleness
and disagreement bugs that cannot occur.

**Refused deliberately:** every technology in §0.1b that would make AGE look like an ecosystem
platform before the semantic loop is proved to work.

## 6. What this authorizes — exactly one slice

One organisation → two real peer observations → AGE relates them to the real BIF → one derived
cross-system insight → visible in Studio with provenance, epistemic state, as-of and what AGE does
not know → retrievable by a peer as a context projection.

Deliverables, one PR each: (1) `@age/source-observation`, pure · (2) one append-only Prisma model ·
(3) `age_record_source_observation`, entitlement-gated before acceptance, refusal as a **result**
never a JSON-RPC error · (4) observation → BIF subject association — ⚠️ **relating is not
believing** · (5) `@age/derived-intelligence`, one deterministic rule, 🚫 no model call ·
(6) Studio: source systems, peer products, the conclusion with every contributing observation ·
(7) `age_get_client_context`, the projection, entitled on read.

🚫 **Not in the slice:** HTTP ingest · scheduler · a second derivation rule · projections for
Ads/Content/SNARA/Humantik · BKG node production · SIE · timeline · credential storage · any write
to any external system.

🛑 **The demonstration is gated on a real intake and a real peer push. That gate is the feature** —
🚫 not an obstacle to be removed with a fixture.
