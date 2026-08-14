# ADR-0071 — Where a peer presents itself

Status: **Accepted** (2026-08-14) — 🚫 **NOT self-accepted.** The Product Owner answered §4 in their
own words; the answer is recorded verbatim in §0.1, with the clarifications they attached in §0.1b.
⚠️ It authorizes the **SHAPE, 🚫 not a slice** (§5), and ⚠️ **§0.1b sequences the first slice behind
ADR-0070 D2** — read §0.1b before writing any outbound code.

Depends on: ADR-0069 (D3, D5, deliverable 7), ADR-0068 (§0.1b, §0.1c), ADR-0066 (D1, D7),
ADR-0062 (D1–D3), ADR-0058 D2, ADR-0057 D4, ADR-0046 D5.
Supersedes: nothing. Companion: `docs/product/ecosystem-integration/EI_01_TRACK.md` §E0.1 gap A.

---

## 0.1 The Product Owner's answer (2026-08-14)

⚠️ **This ADR was 🚫 NOT self-accepted.** §4 was put to the Product Owner as the decision request it
was written to be, and the Product Owner answered it. ⚠️ Unlike ADR-0068 §0.1, the answer was 🚫 not
a selection from labelled shapes — it was given in the owner's **own prose**, which selects option 3
by restating its mechanism rather than by naming it. Quoted verbatim, unedited:

> **Accept ADR-0071.**
> Your stated architecture is already clear: for V1, AGE does not directly authenticate or
> communicate with peer products. The operator is the transport boundary.
>
> So:
>
> Peer → Operator → AGE → Operator → Peer
>
> That is consistent with the current Claude-only constraint and avoids prematurely creating a
> machine-to-machine trust boundary.

🛑 **That is D1 (option 3), and it carries D3 with it** — "avoids prematurely creating a
machine-to-machine trust boundary" is the owner affirming the deferral of Q2, not postponing an
answer they intended to give.

### 0.1a The architect's recommendation and the owner's answer agree — a fact, 🚫 not a confirmation

⚠️ §4 recorded D1 as the architect's decision and §2 wrote all four shapes, so the owner selected
from a framing that was entirely the architect's. ⚠️ **Agreement here is not independent
corroboration** (finding 7). The owner's prose reaches option 3 by its own route — _"the operator is
the transport boundary"_, an argument from the **Claude-only constraint** rather than from ADR-0069
D3's symmetry — but 🚫 that is a second reason for the same shape, and 🚫 not a second observer. If
§2 omitted the right shape, this acceptance carries that omission forward.

### 0.1b The three clarifications the owner attached — 🛑 binding, and 🚫 not commentary

**1. 🛠️ SEQUENCING — ADR-0070 D2 IS ANSWERED BEFORE THIS ADR'S FIRST SLICE IS BUILT.** Verbatim:

> Resolve ADR-0070 D2 next. I agree this should take priority over the outbound ecosystem slice.
> The reason is strategic: document ingestion is part of AGE's intelligence-building capability,
> whereas outbound peer projection is the final leg of the ecosystem loop.
> The natural sequence is: Business documents → AGE → provenance-aware draft → BIF/intelligence →
> Studio. Then: AGE intelligence → operator → RankOps / SNARA / Humantik / Content Intelligence.
> That gives you something meaningful to test before worrying about automated peer-to-peer
> communication.

🛑 **This acceptance therefore does not make the outbound half of ADR-0069 deliverable 7 the next
slice.** It makes it buildable, and 🚫 not imminent. ⚠️ The projection has nothing worth carrying to
a peer until AGE can read a real client document, so building the transport first would demonstrate
a working pipe with nothing in it.

**2. 🛑 A CORRECTION TO HOW THE SHIPPED INBOUND HALF IS DESCRIBED.** The owner rejected the sentence
_"AGE can now receive information from a peer product, reason over it, and show the result on
screen"_ as imprecise, and fixed the wording:

> What is shipped is the AGE-side semantic machinery and operator-mediated relay, not a real
> integration with RankOps. […] The actual status should remain: **AGE can accept a correctly shaped
> observation through its relay mechanism.** It does not mean: RankOps ↔ AGE integration is working.

🛑 **"A peer sent AGE an observation" is 🚫 NEVER said of the shipped relay.** What is true is that
**an operator** presented a correctly shaped observation and AGE accepted it. ⚠️ No peer repository
contains AGE code, so no peer has ever sent anything. This is D4 applied to the **inbound**
direction, which D4's table did not spell out — 🚫 the non-conflation rule is not outbound-only.

⚠️ The owner also restated `EI_01` §E2.3's completion criterion and asked that it stay permanently on
the roadmap: the first real integration is complete only at
`RankOps → AGE contract → AGE accepts → AGE relates → AGE derives → AGE displays`, then
`AGE → outbound contract → RankOps`, **with an actual round-trip test against the real RankOps
system**. That is §E2.3 + §E2.4 unchanged; 🚫 nothing about this acceptance moves it.

**3. ⚠️ GAPS B AND C ARE NOT TO BE WRITTEN MERELY TO COMPLETE THE DOCUMENTATION.** Verbatim:

> I agree these are legitimate gaps, but I would not rush to write them merely to make the
> documentation "complete."

The owner then constrained both future ADRs in advance. **Gap B** — a peer reporting something the
BIF does not say is _"conflicting information exists"_, and AGE 🛑 must never let that become _"AGE
has decided the BIF is wrong."_ ⚠️ Note also that not every difference is a contradiction: a peer
reporting a decline in a market the BIF names is **agreement plus new information**, 🚫 not a
conflict. **Gap C** — 🛑 **observation age ≠ observation validity.** An observation made in the past
remains historically true _as an observation_; what age may affect is whether AGE should use it when
constructing a **current** conclusion. 🚫 An ADR that lets ageing decide truth is answering the wrong
question. ⚠️ Both constraints are pre-recorded here so the eventual ADRs are measured against them.

### 0.1c What is still refused, unchanged by this acceptance

🚫 Everything in §5's "not authorized, by name" list stands, and §6's revisiting trigger is unchanged:
a **real peer adapter that has something to say and no way to say it** — 🚫 not a prediction, and
🚫 not the manual step becoming tiresome. 🛑 **The Operator 2 account remains a human act** — the
owner reaffirmed it: _"This is not something Claude should build. If the architecture deliberately
says provisioning is an out-of-band human action, keep it that way."_ (ADR-0068 §0.1c.)

---

## 1. Context — the gap, stated precisely

ADR-0069 deliverable 7 is `age_get_client_context`, the outbound projection, **entitled on read**.
Six of the seven deliverables shipped (#300–#319). The seventh did not, for a reason recorded in the
package's own header: the only `Authentication` anyone could construct was `{ kind: 'none' }`, so a
tool wired through `readWithinEntitlement` would have refused every call.

PR #322 shipped the durable read behind `verifyPresentedSessionToken`, so
`{ kind: 'verified-session' }` is now constructible. The blocker is therefore no longer capability.
It is a question nobody has answered:

> 🛑 **Where does a peer product present a credential to AGE?**

⚠️ **This ADR exists because that question cannot be answered by reading the code.** Every available
answer is a different architecture, and three of the four create a trust boundary AGE does not have
today.

### 1.1 🛑 The framing correction that governs this ADR

⚠️ **The transport decision must be made against the ecosystem goal, not against the convenience of
making deliverable 7 technically callable.** Choosing a transport because it is the shortest path to
a green tool is how a permanent machine-to-machine security architecture gets adopted by accident,
in a slice whose stated purpose was something else.

🛑 **There are therefore TWO questions here, and this ADR keeps them apart:**

|        | Question                                              | This ADR                         |
| ------ | ----------------------------------------------------- | -------------------------------- |
| **Q1** | How do we prove AGE's intelligence loop?              | **Answers it** (D1)              |
| **Q2** | How do autonomous peer products communicate with AGE? | 🚫 **Explicitly defers it** (D3) |

🚫 An answer to Q1 is not a partial answer to Q2, and 🚫 must never be extended into one by
increments.

## 2. The four shapes

**Option 1 — a token in the tool's own arguments.** `age_get_client_context(clientId, token)`. The
peer names its credential per call.

**Option 2 — a token presented once, at MCP session establishment.** "RankOps is an authenticated
AGE peer" becomes a persistent concept.

**Option 3 — operator-mediated outbound, mirroring ADR-0069 D3.** The operator carries the
projection out, exactly as they carry an observation in. 🛑 **The peer never authenticates to AGE at
all**, because the peer never talks to AGE.

**Option 4 — operator-read-only.** The projection is a Studio surface and nothing else; "peers pull
from AGE" becomes a **decision** rather than a gap (the ADR-0067 shape).

🚫 **A fifth shape is refused by name: authentication middleware around the MCP surface.** A
middleware authenticates every tool by default — including `age_relay_source_observation` and the
ten read tools that exist today — so it would silently change the trust model of the entire MCP
surface as a side effect of shipping one outbound tool. ⚠️ That is a far larger crossing than
deliverable 7, and it would not appear in the diff as one.

## 3. Why options 1 and 2 are premature

**Option 1 does not add a parameter. It adds a trust boundary**, and the boundary arrives with ten
unanswered questions, none of which is an implementation detail:

who issued the token · who owns it · how is it rotated · where is it stored · what scope does it
carry · what happens when the peer is compromised · can one peer credential reach another client ·
how does AGE distinguish a peer from an operator · is the token per peer, per organisation or per
client · how is revocation handled.

⚠️ **AGE's existing token model was accepted for two humans and explicitly not for ten** (ADR-0068
§0.1c). A peer product is not the eleventh human; it is a different kind of principal entirely, and
`Authentication` currently has no arm for one. 🚫 Adding that arm inside deliverable 7 would answer
ADR-0062's principal model by accident.

**Option 2 is probably the better long-term architecture** — a session-level credential is cleaner
than a per-call one once AGE exposes a real authenticated peer protocol. That is precisely the
reason not to take it here: it implies a durable concept ("RankOps is an authenticated AGE peer")
that deserves deliberate architecture, and 🚫 must not be smuggled in as the transport of one tool.

## 4. Decisions

**D1 — For V1, the outbound projection is OPERATOR-MEDIATED (option 3).**

```
RankOps ──observation──▶ Operator ──▶ AGE ──derived intelligence──▶ Studio
                                                                      │
RankOps ◀── Operator ◀── AGE ◀──────────── operator requests projection┘
```

🛑 **Symmetry is the argument.** ADR-0069 D3 already made inbound transport operator-mediated. An
outbound path that authenticated a machine would make the two directions asymmetric in their trust
model while the loop they form is still unproven. The operator is the trust boundary in both
directions, or the slice has quietly introduced a second one.

🚫 **No peer credential, no peer principal, no peer session, no new `Authentication` arm.** The
caller of the projection is the operator, authenticated as the operator already is, and
`askEntitlement` is asked exactly as it is asked everywhere else.

**D2 — 🛑 Operator mediation is a V1 TRANSPORT CONSTRAINT, 🚫 NOT the permanent ecosystem
architecture.** It is recorded here as a constraint with an expiry condition (§6), 🚫 not as a
principle, and 🚫 not as a preference. ⚠️ Anyone reading this ADR later must be able to see that the
manual step was chosen deliberately and is expected to be replaced — 🚫 it must not calcify into
"AGE is designed around an operator copying things."

**D3 — 🛑 The authenticated peer protocol is EXPLICITLY UNRESOLVED, and deferring it is the
decision.** 🚫 Not an oversight, 🚫 not a backlog item, 🚫 not something a later slice may settle in
passing. It needs its own ADR answering all ten questions in §3 before a single line of peer
authentication is written.

**D4 — 🛑 PROVING THE INTELLIGENCE LOOP IS NOT COMPLETING THE PEER INTEGRATION. These are two
different claims and are 🚫 NEVER reported as one.**

|                | The loop                                  | The integration                        |
| -------------- | ----------------------------------------- | -------------------------------------- |
| Shape          | `peer → operator → AGE → operator → peer` | `peer → AGE → peer`                    |
| Proves         | AGE's semantics, reasoning and honesty    | that a real peer adapter can reach AGE |
| Settled by     | this ADR's V1 slice                       | 🛑 `EI_01` §E2.3, and nothing less     |
| Rung (`EI_00`) | up to **5**                               | **6**                                  |

🛑 **A projection an operator copied into RankOps by hand is rung 5 and is 🚫 NEVER reported as rung 6.** ⚠️ This decision exists because of a specific, predictable failure: six months from now, "the
RankOps integration is done" would be said about an operator with a clipboard, and everyone would
believe it — the slice really did work, and the sentence really is false.

**D5 — The projection's shape is unchanged by the transport** (ADR-0069 §3, seven parts including
🛑 what AGE does not know, named; 🚫 no instruction, ever). ⚠️ **If option 3 tempts anyone to widen
the payload "since a human is reading it anyway", that is a refusal, not a convenience** — the
projection a peer will eventually receive must be byte-comparable to the one an operator carries,
or the V1 transport has changed the contract instead of standing in for it.

## 5. What this authorizes

⚠️ **The SHAPE, 🚫 not a slice** (the ADR-0068 §0.1e pattern). If accepted, the outbound half of
deliverable 7 becomes buildable under the standing per-slice process as an **operator-invoked**
surface. 🚫 Nothing here authorizes any peer-side code (`EI_00`, the scope rule).

🚫 **Not authorized, by name:** a peer credential of any kind · a new `Authentication` arm · an HTTP
ingest or egress endpoint · MCP middleware · a scheduler or background sync · a bulk or multi-client
projection · a projection containing an instruction · storing derived intelligence (ADR-0069 D2) ·
any write surface (ADR-0057 D4).

## 6. Consequences, and when this is revisited

**Accepted willingly:** the loop does not scale, and every projection costs an operator's attention.
That is the same trade ADR-0069 D3 made inbound, taken for the same reason — the scaling answer is a
larger crossing that must be **earned by a working loop**, not assumed by a promising one.

**Refused deliberately:** a machine-to-machine trust boundary adopted as a side effect of shipping a
read tool.

🛑 **The revisiting trigger is a real peer adapter that has something to say and no way to say it** —
🚫 not a prediction that one will exist, and 🚫 not the manual step becoming tiresome. ⚠️ When it
fires, the answer is a new ADR against Q2 (D3), 🚫 not an extension of this one.

## 7. Open questions

1. **Does the operator carry the projection as a file, a copy, or a CLI print?** Deliberately not
   decided here — it is a slice-level question about an operator-invoked surface, and each option is
   inside D1. ⚠️ It must not become a _write_ surface in either direction (ADR-0057 D4).
2. **Does the ecosystem track's E1 contract get versioned before or after Q2 is answered?** `EI_01`
   §E1 requires the contract be transport-independent, which suggests before — 🛑 but if the
   authenticated protocol forces a semantic change, the contract had one consumer and E1 must say so.
