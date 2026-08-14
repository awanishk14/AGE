# EI_01 — The Track: E0 → E4

> Part of the [Ecosystem Integration & Peer Validation Track](./EI_00_README.md). Read `EI_00`
> first: the reporting ladder, the scope rule and the permanent constraints bind every stage here.
>
> 🚫 **This document authorizes no code.** Each stage names what it still needs.

## The architectural model, restated once

```
Peer Product  →  AGE observation contract  →  AGE semantic model / reasoning
                                                        ↓
Peer Product  ←  AGE context projection    ←  AGE-derived intelligence
```

AGE is the semantic authority. The peer product is authoritative for its own domain. Cross-product
intelligence is produced **only** by AGE reasoning over the shared organisation/client semantic
model — 🚫 never by two peers wiring themselves together.

---

## E0 — AGE canonical ecosystem contracts

**Goal:** before any peer repository changes, the semantics required for ecosystem communication are
established and frozen.

⚠️ **Most of E0 is already decided. This stage is a check, not an invention.** The table below maps
each required semantic to the decision that already governs it. 🚫 Do not re-derive a row that is
already `Accepted` — read the ADR.

| #   | Semantic                                  | Decided by                                               | Where it lives                           | State                  |
| --- | ----------------------------------------- | -------------------------------------------------------- | ---------------------------------------- | ---------------------- |
| 1   | **SourceObservation**                     | ADR-0069 §3 — the five-part envelope                     | `@age/source-observation`                | ✅ Accepted, shipped   |
| 2   | **Semantic subject association**          | ADR-0069 **D4** — admissibility BY SUBJECT               | `@age/observation-association`           | ✅ Accepted, shipped   |
| 3   | **Claim direction / materiality**         | ADR-0069 §3 — bands and directions only                  | `observation-claim.ts`                   | ✅ Accepted, shipped   |
| 4   | **Period**                                | ADR-0069 §3 — `observedAt` + the window                  | `observation-period.ts`                  | ✅ Accepted, shipped   |
| 5   | **Provenance**                            | ADR-0066 **D6** + AGE-INV-PROV-1                         | `observation-provenance.ts`              | ✅ Accepted, shipped   |
| 6   | **claimKind**                             | ADR-0066 **D5** — raw vs source-derived                  | `CLAIM_KINDS`                            | ✅ Accepted, shipped   |
| 7   | **DerivedIntelligence**                   | ADR-0069 **D1/D2/D7**                                    | `@age/derived-intelligence`              | ✅ Accepted, shipped   |
| 8   | **Provenance of a derived conclusion**    | ADR-0069 D7 — every contributing observation             | `ContributingObservation`                | ✅ Accepted, shipped   |
| 9   | **Contradiction handling**                | 🛑 **partially decided — see §E0.1**                     | —                                        | 🛑 **gap**             |
| 10  | **Ageing / lifecycle**                    | ADR-0069 **D2** for conclusions; 🛑 not for observations | `asOf` as a parameter                    | 🛑 **partial gap**     |
| 11  | **Operator relationship to a conclusion** | ADR-0069 **D3** — operator-mediated relay                | Studio Intelligence / Peer Products      | ✅ Accepted, shipped   |
| 12  | **Context projection back to peers**      | ADR-0069 §3 — the seven parts, incl. unresolved          | `@age/client-context-projection`         | ✅ Accepted, shipped   |
| 13  | **Entitlement**                           | ADR-0066 **D7**, ADR-0062 D1–D3, ADR-0068                | `@age/entitlement`, `@age/entitled-read` | ✅ Accepted, shipped   |
| 14  | **Transport boundary**                    | 🛑 **UNDECIDED**                                         | —                                        | 🛑 **gap — blocks E1** |

### E0.1 — The three semantic decisions E0 is missing

🛑 **These are surfaced, not chosen.** Each needs a `Proposed` ADR answered by the Product Owner
before the stage that depends on it may proceed.

**Gap A — the transport boundary (row 14). ⚠️ SPLIT IN TWO by ADR-0071 (`Proposed`, #325).**
The projection is a pure function with no surface. ADR-0071 separates the question that was being
asked as one:

- **Q1 — how is AGE's intelligence loop proved?** ADR-0071 **D1**: operator-mediated outbound, the
  mirror of ADR-0069 D3's inbound relay. 🚫 No peer credential, no peer principal, no new
  `Authentication` arm. **This unblocks E1's semantics — it does 🚫 NOT satisfy E2 direction 2.**
- **Q2 — how do autonomous peer products communicate with AGE?** ADR-0071 **D3**: 🛑 **explicitly
  unresolved, and deferring it is the decision.** It needs its own ADR answering all ten trust
  questions (ADR-0071 §3). 🛑 **E2 direction 2 is blocked on Q2, not on Q1.**

🚫 It must not arrive as a middleware — a middleware authenticates every tool by default, including
the inbound relay, which is a far larger crossing.

### 🛑 E0.1a — The non-conflation rule (ADR-0071 D4)

🛑 **Proving the intelligence loop is not completing the peer integration. They are two different
claims and are 🚫 NEVER reported as one.**

|                | The loop                                  | The integration                        |
| -------------- | ----------------------------------------- | -------------------------------------- |
| Shape          | `peer → operator → AGE → operator → peer` | `peer → AGE → peer`                    |
| Proves         | AGE's semantics, reasoning and honesty    | that a real peer adapter can reach AGE |
| Settled by     | the V1 slice under ADR-0071 D1            | 🛑 §E2.3, and nothing less             |
| Rung (`EI_00`) | **up to 5**                               | **6**                                  |

🛑 **A projection an operator carried into RankOps by hand is rung 5.** 🚫 It is never rung 6, never
"RankOps integrated", and never counted toward the Definition of Done items 6–8. ⚠️ The failure this
rule prevents is specific and predictable: the slice really does work, and the sentence "the RankOps
integration is done" really is false.

⚠️ **Operator mediation is a V1 transport constraint with an expiry condition** (ADR-0071 D2) —
🚫 not a principle, and 🚫 not the permanent ecosystem architecture.

**Gap B — contradiction between derived intelligence and BIF/evidence (row 9).**
Decided: two source systems that disagree are **reported as disagreement**; 🛑 AGE does not pick a
winner by recency, materiality, source reputation or count. Undecided: what happens when a derived
conclusion contradicts **the BIF itself** — what the business said about its own model. 🚫 The
answer must not be "the observation wins" or "the BIF wins" by default. ⚠️ `detectContradictions`
exists, is unwired, and over an empty list returns an empty set — 🚫 it must never be reached for as
the answer here, because "AGE has never looked" would render as "AGE checked and it is sound."

**Gap C — observation ageing (row 10).**
Conclusions cannot go stale: D2 recomputes them, so nothing outlives its evidence. But an
**observation** carries a period and nothing expires it — an eighteen-month-old observation
contributes to a conclusion identically to yesterday's. 🚫 Do not close this with a TTL, a
background job or a delete: the store is append-only. The likely shape is a derivation-time rule
over the period already on the envelope, and it needs a decision, not a default.

**Exit criterion for E0:** gaps A, B and C each have an `Accepted` ADR, and the contract version
(§E1.1) is stamped.

---

## E1 — The AGE reference peer contract

**Goal:** one canonical, versioned, **transport-independent** AGE ↔ peer contract.

⚠️ **Transport independence is the point of the stage.** The semantics of rows 1–13 are already
transport-free — they are types over an envelope. 🚫 Do not let gap A's answer leak into the
semantic contract: the envelope must not gain a field that only makes sense over one transport.

The contract document must answer all ten, in writing:

1. **What may a peer send?** — observations only. 🚫 Not raw metrics, not documents, not events.
2. **What must every observation contain?** — the five parts (rows 1–6), complete. 🚫 No optional
   provenance.
3. **What does AGE refuse?** — inadmissible subject (D4) · incomplete provenance (ADR-0066 D3) ·
   unknown/unnamed source (D6) · malformed envelope · unentitled caller (D7). 🚫 Refusals are never
   downgraded into a stored-but-flagged row.
4. **How is provenance represented?** — `sourceSystem`, `sourceInstance`, `sourceRecordId`,
   `organizationScope`; 🚫 no default anywhere, and two origins for one field stay two.
5. **How is an observation associated with an AGE subject?** — `deriveModelledSubjects` over the
   existing model; ⚠️ **relating is not believing**, and an unassociable observation is **carried,
   never discarded and never guessed into a subject**.
6. **What may AGE return?** — the seven-part projection, including 🛑 **what AGE does not know,
   named**. 🚫 No projection ever contains an instruction.
7. **Projection vs raw export** — a projection is AGE's _conclusion and context_ for one
   organisation/client, scoped and derived. 🚫 A peer may never retrieve another peer's
   observations, the BIF wholesale, or any bulk record set. If it looks like an export, it is out
   of contract.
8. **How is tenant/client scope enforced?** — `askEntitlement` **before** the read, a denial
   **raises** and 🚫 never returns `[]`; scope re-derived from the verified session, 🚫 never from
   the caller's claim. ⚠️ RLS underneath is coherence, not authorization.
9. **How are errors/refusals represented?** — as a **result**, 🚫 never a JSON-RPC error; carrying
   its reason; naming a **position**, 🚫 never the tenant, the digest, record contents or another
   client's id.
10. **How does the peer learn the outcome?** — three distinct outcomes that are 🚫 never collapsed:
    **accepted and associated** · **accepted, could not associate** (carried, with the reason) ·
    **refused** (with the reason). ⚠️ "Received and found nothing" and "did not run" are different
    states and must be distinguishable by the peer, not only by the operator.

### E1.1 Contract versioning

The contract carries an explicit version, recorded in every validation round (§E2.4). 🚫 A peer
adapter that does not state which contract version it implements has not reached rung 3.

**Exit criterion for E1:** the contract document exists, is `Accepted`, and is stamped `v1`.

---

## E2 — First real peer integration: RankOps

**Why RankOps first:** SEO/search observations map most directly onto subjects AGE already models
(services, audiences, geographies, priorities), so the first round tests the _contract_ rather than
the subject model. It is also read-heavy, which keeps the first crossing inside the V1 boundary —
🚫 no execution, no side effects.

### 🛑 What does NOT make E2 complete

- 🚫 AGE has an endpoint.
- 🚫 An AGE adapter exists.
- 🚫 Tests pass using fixtures.
- 🚫 Two repositories compile.
- 🚫 Someone read the JSON response and it looked right.

### E2.1 — Direction 1: RankOps → AGE

RankOps sends **at least one genuine RankOps observation** through the agreed mechanism. AGE must:

- authenticate/authorize the caller per the accepted entitlement model;
- identify the peer/source (D6 — an unnamed source is refused);
- validate the observation and validate provenance (incomplete provenance is **refused**, 🚫 never
  downgraded to `stated`);
- associate it with an **existing** AGE semantic subject (D4) — or carry it unassociated, with the
  reason;
- persist it where the architecture requires persistence (append-only, `GRANT SELECT, INSERT`);
- expose the resulting observation in Studio with its source and provenance;
- distinguish **"received and found nothing"** from **"did not run"**;
- refuse malformed/unattributed observations honestly, as a result carrying its reason.

🛑 **No fabricated observation may be used to declare the integration successful.** A fixture that
travels the real path is a rung-5 result at best.

### E2.2 — Direction 2: AGE → RankOps

RankOps requests an AGE context projection through the agreed contract. AGE returns **only** the
context RankOps is entitled and contractually allowed to receive.

🛑 **RankOps must actually consume the projection through its own adapter/client boundary** and act
on it within its own domain. 🚫 Manually inspecting the JSON is not consumption and does not count.

### E2.3 — The mandatory completion test

> 🛑 **The RankOps integration is complete only after one real end-to-end communication round has
> succeeded in both directions: RankOps → AGE with a real observation, and AGE → RankOps with a real
> context projection consumed by RankOps.**

The validation is performed against the **actual repositories and actual running implementations** —
🚫 not mocked contract tests.

### E2.4 — The evidence record (all nine fields, or the round did not happen)

Recorded in `docs/reviews/` as the first ecosystem integration proof:

1. AGE version/commit · 2. RankOps version/commit · 3. contract version · 4. observation sent ·
2. AGE acknowledgement/result · 6. context requested · 7. context returned · 8. RankOps
   consumption/result · 9. any refusal/error behaviour encountered.

⚠️ **Field 9 is not optional and is not a bug report.** A round that encountered no refusal did not
exercise the refusal path, and the refusal path is where every honesty guarantee in this program
actually lives. If nothing was refused, refuse something deliberately and record it.

---

## E3 — Second peer validation

Begins **only** after E2 has passed the real round.

**Recommendation: Content Intelligence.** ⚠️ Reasoned, not arbitrary — and 🚫 not a decision:

- **It is the strongest test of D7.** ADR-0069 D7 requires _two producers_ before AGE will state a
  conclusion. RankOps and Content Intelligence observe overlapping subjects (a service, an
  audience, a geography) from genuinely different angles, so the pair can produce a **real**
  convergent conclusion that neither could produce alone. That is the first evidence that AGE
  reasons _across_ domains rather than restating one source.
- **It stays inside the V1 boundary.** MCP Ads Server is the natural alternative and is the better
  commercial story, but it is an execution surface — the first crossing would drag in the execution
  boundary (Doc 11 §4, Doc 12 §6.1, ADR-0057 D4 class 3) and confound "does the contract
  generalise?" with "may AGE act?". Those must be answered separately.
- **SNARA and Humantik test the subject model, not the contract.** Both introduce subjects AGE may
  not yet model (conversations; catalogue/SKU economics), so a failure would be ambiguous — the
  contract or the semantic model? A second integration must isolate the contract.

**Exit criterion:** the same contract, unchanged in its semantics, carried a second peer — proving
it is not secretly a RankOps-specific API. ⚠️ **If E3 requires a contract change, say so plainly and
version it** (§E1.1); a contract that needed reshaping for its second consumer had one consumer.

---

## E4 — Ecosystem expansion

After the reference contract has survived two real peer integrations, extend to the remaining peers.
Each integration must have all eight:

- AGE-side contract implementation · peer-side adapter/client implementation · entitlement/scope
  handling · provenance handling · refusal handling · end-to-end validation (rung 6) · Studio
  visibility where appropriate · the contract version actually used, documented.

Future third-party products and subscriptions follow the same pattern. 🚫 A third party gets no
shortcut: it is an **External Integration** by ownership (Doc 11 §2.1) and the contract is the same.

---

## Definition of Done — the ecosystem integration program

🛑 **Not complete merely because AGE-side integration packages exist.** Complete only when all ten
hold:

1. AGE canonical peer contract exists and is **Accepted**.
2. RankOps has a real AGE adapter/client.
3. AGE has the corresponding integration boundary.
4. RankOps → AGE has transmitted a **real** observation.
5. AGE validated, associated and stored/represented it correctly.
6. AGE → RankOps returned a **permitted** context projection.
7. RankOps **actually consumed** that projection.
8. The round was verified against real running implementations on both repositories.
9. Actual repository commits/versions were recorded (§E2.4).
10. **At least one second peer** completed the same contract pattern, proving RankOps was not a
    one-off special case.

⚠️ Nine of ten is not done, and 🚫 the missing one is never reported as a rounding error.
