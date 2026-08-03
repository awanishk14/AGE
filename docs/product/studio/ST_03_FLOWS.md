# ST_03 — Operator flows, and where each one stops today

Status: **Proposed**. 🚫 Authorizes no code.

⚠️ Each flow is written end to end as the owner described it, then marked with **where it stops on
`main` today**. The stopping point is the deliverable — a flow diagram with no stop marker is a flow
diagram that lies.

---

## F1 · First run — "I have opened AGE Studio and I have nothing"

```
launch studio  →  loopback check  →  no identity  →  Dashboard
      │               │                  │             │
      │               │                  │             └─ every panel: "Not assessed", with reasons
      │               │                  └─ "Continue as operator". 🚫 nothing is verified
      │               └─ refuses to start if the bind host is not loopback (OX-INV-1) ✅ SHIPPED
      └─ 127.0.0.1:3100 ✅ SHIPPED
```

**Stops:** nowhere — this flow works today and is honest. ✅

## F2 · "Show me my businesses"

```
Dashboard → Businesses → [organizations derived as bands] → select a business → Business Profile
```

**Stops at Business Profile.** ✅ Businesses is buildable now off `@age/client-registry`.
⚠️ Business Profile can show the **name and ids** and nothing else: every business _attribute_ the
owner listed lives in a BIF, and no BIF has been read (ADR-0055 D7).

## F3 · "Onboard a new business" — the owner's step 4

```
[intended]  Create organization → invite members → create client → business profile → discovery
[today]     operator edits their own record file (outside the repo) → age-capture onboard (CLI)
```

**Stops immediately.** 🛑 Three independent blocks, and they must not be confused with each other:

1. **No tenant model.** There is no organization aggregate to create into.
2. **No identity.** "Invite members", roles and permissions have no principal to attach to.
3. **The console is read-only** by the owner's own answer to ADR-0057 open question 1.

⚠️ Any one of these alone stops the flow. 🚫 Fixing the read-only answer does not unblock it.

## F4 · "Run discovery for this business"

```
Business → Discovery → answer 17 questions across 9 sections → validate → submit → BIF
                            ✅ real contract        ✅ real         🛑 DISABLED    🛑
```

**Stops at submit.** The rendering, the progress, the validation and the resume _view_ are all
buildable today against the real questionnaire. ⚠️ Enabling the button is **runtime-caller wiring** —
the thing ADR-0054 §0.1d stopped — and needs its own decision (ADR-0058 §6 open question 3).

⚠️ **"Resume later" has a subtlety worth stating:** resume state is the operator's answer file. A
read-only console can _display_ progress from that file but 🚫 cannot save a half-finished answer to
it. Until the write question is answered, "resume" means _"re-open and see what your file contains"_,
not _"pick up where the browser left off"_. 🚫 Do not implement browser-local draft storage as a
substitute — a draft that exists only in `localStorage` is a second, invisible source of truth.

## F5 · "Read the BIF and follow a claim to its evidence"

```
BIF → statement → source → evidence item → Evidence Timeline → the discovery answer that produced it
```

**Stops at the first step.** 🛑 ADR-0055 D7: no snapshot has been read. ⚠️ **This flow is the product's
core value proposition** — traceability from a belief to its origin — and the model supports it
completely: field provenance, evidence links, immutable snapshots and confidence all exist as types.
🚫 Nothing computes them into a readable whole.

## F6 · "Something looks wrong — show me the contradiction"

```
Contradictions → contradiction → evidence A | evidence B → confidence → suggested resolution → decide
```

**Stops at the list.** 🛑 No detector exists. 🚫 A contradiction must never be produced by a UI rule
("these two strings differ"), which would make the differentiator a text-comparison trick.

## F7 · "Give me a strategy"

```
BIF + Evidence + Graph → Strategy board → card → reason + evidence + dependencies → approve → execute
```

**Stops at the board.** 🛑 The decision layer is 35 files of contracts with zero functions, and
**approve → execute** is additionally blocked by the deliberate execution revert (ADR-0057 open
question 3, OPEN).

## F8 · "What changed since last month?"

```
History → pick two snapshots → diff → new / removed / changed / confidence ± / resolved
```

**Stops at "pick two".** ⚠️ There are zero snapshots, and a diff engine does not exist. ✅ The
append-only storage model means this flow will be correct whenever it is built — 🚫 which is not a
reason to build the screen before there is anything to compare.

## F9 · "What do the peer products say?"

```
Peer Products → RankOps widget → project → open in RankOps ↗
              → MCP Ads widget → account → open in MCP Ads ↗
```

**Stops at the widget.** 🛑 No client for either product exists; ADR-0057 open question 2 (which peer
product is first) is OPEN. ✅ The **Open in ↗** link is buildable now and is honest on its own — it is
navigation, not data.

## F10 · "Is AGE itself working?"

```
Diagnostics → packages → capabilities + readiness → identity → bind host → database → queues
```

**Stops at queues** (none exist) **and identity** (does not exist). ✅ Everything before that is real
today. This is the second-most buildable flow in the product after F2.
