# ADR-0071 — Where a peer presents itself

Status: **Proposed** (2026-08-14) — 🚫 **NOT self-accepted.** It authorizes **nothing** until §0.1
carries the Product Owner's answer verbatim.

Depends on: ADR-0069 (D3, D5, deliverable 7), ADR-0068 (§0.1b, §0.1c), ADR-0066 (D1, D7),
ADR-0062 (D1–D3), ADR-0058 D2, ADR-0057 D4, ADR-0046 D5.
Supersedes: nothing. Companion: `docs/product/ecosystem-integration/EI_01_TRACK.md` §E0.1 gap A.

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
