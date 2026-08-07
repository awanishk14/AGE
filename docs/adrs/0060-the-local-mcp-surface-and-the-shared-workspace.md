# ADR-0060 — The local MCP surface, and the workspace both surfaces must share

Status: **Accepted** — by the **Product Owner**, 2026-08-08, in their own words (§0.2).
🚫 **NOT self-accepted.** The architect proposed the shape in answer to a direct question and the
Product Owner chose it; the choice is quoted verbatim in §0.2.
⚠️ **Acceptance authorizes a LOCAL surface only.** 🚫 It authorizes **no hosting, no network
listener, no identity, no session, and no remote database** — every one of those is deferred to
**ADR-0061 (ADR K)**, which is `Status: Proposed` and 🚫 must not be self-accepted.
⚠️ It does **NOT** discharge **ADR-0055 D7** (the operator's own write), and 🚫 does not weaken
`assertLocalDatabaseTarget`, whose refusal of a tunnelled remote database **stands unchanged**.
Date: 2026-08-08
Relates to: ADR-0053 **D3** (real client records are never committed) and **D4** (the operator
principal is provenance, never authorization), ADR-0054 **D2/D3** (an operator file's path is never
defaulted, and the rule has exactly one implementation) and **D6's five conditions**, ADR-0055 **D6**
(the operator's own local database) and **D7** (the row nobody reads), ADR-0057 **D2** (the loopback
invariant) and **D4** (the three action classes — 🚫 Business Execution refused), ADR-0058 **D2**
(the three-valued entitlement answer) and **§6 Q1** (the tenant boundary, still unanswered),
ADR-0059 **D1** (a fact is proposed, never prefilled) and **D6** (assisted intake).

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by the mandate of
2026-07-30 — but the load-bearing authorization here is **not** the grant. The Product Owner asked a
direct question, was given the architect's reading of the two halves, and **chose one of them**. That
choice is the authorization, and §0.2 records it verbatim rather than paraphrased.

### 0.2 The Product Owner's words

The Product Owner described the shape they wanted by reference to a sibling product, RankOps:

> _"i want it to work just like rankops. which is cli/mcp. everything is on server by controlled
> locally through terminal claude subscription."_

and, after the architect's answer distinguished the client half from the server half:

> _"i will want this path later when i am building saas - If you want the VPS shape specifically, the
> honest path is: ADR K first (identity, session, entitlement with real granted/denied arms), so we
> need to scope in but currently, local Postgres also works. lets give it that shape"_

⚠️ **THE SENTENCE THAT BOUNDS THIS ADR IS "currently, local Postgres also works."** The Product Owner
did not defer the hosted shape reluctantly; they **separated** it, named the precondition (ADR K) and
asked for it to be **scoped, not built**. 🚫 An implementation that quietly makes hosting possible
"while we're in here" is therefore not an optimisation — it is the one thing this acceptance
withheld.

### 0.3 What was NOT decided

🚫 The Product Owner did not authorize: a hosted deployment, a public URL, a network listener of any
kind, an identity provider, a session, a login screen, a remote or tunnelled database, a change to
`apps/web`, or any model call. 🚫 **`age.digitaldadi.agency` is not authorized** and no work toward
it is in scope. The hosted shape's preconditions are enumerated in **ADR-0061**, `Status: Proposed`.

---

## 1. Context

### 1.1 The question that produced this

The Product Owner asked whether AGE could be hosted the way RankOps is: a server holding the data, a
CLI and MCP server as the interface, and **no LLM key anywhere**, because the model is Claude running
locally under the operator's own subscription.

Grepping the tree rather than answering from memory established three facts:

1. **AGE has no LLM key and never had one.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `openai` and
   `anthropic` appear in the repo **only inside guard tests**, in lists of tokens the source is
   forbidden to contain. RankOps' "no key" property is an achievement; in AGE it is an invariant the
   build enforces. Every score, mapping, contradiction and readiness assessment is a deterministic
   pure function — which is why the demo emits **98/63 vs 12/17** byte-identically on every run.
2. **A CLI already exists.** `age-capture` (`apps/capture`) dispatches two commands — the default
   capture path and `onboard` (ADR-0054 D6) — from `runCli`, which is **pure over `argv` plus an
   injected runtime**. That is precisely the shape an MCP tool call has.
3. **No MCP server exists.** Nothing in the tree references `modelcontextprotocol`.

So the _client_ half of the RankOps design is a near-perfect fit, and the _server_ half is refused by
rules already in the code — `assertLocalDatabaseTarget`, whose comments name a tunnelled remote
database as exactly what ADR-0055 D6 forbids, and the absence of any authentication, which ADR-0058
makes explicit rather than implicit.

### 1.2 Why the MCP shape suits AGE better than a screen does

The Product Owner's complaint about discovery was that filling it in was tedious and ought to be
assisted. **ADR-0059 D6 answered that in miniature** — record facts are **PROPOSED, never prefilled**,
and the operator presses `Use "…"` to accept each one.

An MCP surface is the same rule at a larger scale and with a better assistant: Claude reads a brief, a
PDF or a set of notes **on the operator's machine**, proposes answers, and AGE continues to do the
deterministic part. ⚠️ The division of labour is the point, and it is the same division ADR-0059 D6
already shipped: **the model proposes, AGE transcribes, and nothing is inferred** (ADR-0050 D2).

🛑 This is why the model must stay in the client. If AGE called a model, AGE would be inferring — and
`produceScoredBifContext` transcribing rather than inferring is the property three ADRs protect.

### 1.3 The obstacle: the workspace lives inside a screen

Every operation an MCP surface would want already exists, in
`apps/studio/src/server/operator-environment.ts` — nine of them:

`readBusinessesView` · `resolveBusinessScope` · `createClientRecord` · `readDiscoveryDraft` ·
`writeDiscoveryDraft` · `submitDiscoveryAnswers` · `generateBifFromAnswerFile` · `assembleEvidence` ·
`reportContradictions` · `assessCapabilityReadiness`

That is very nearly the tool surface, already written and already guarded. But it is **926 lines
inside a Next.js app**, and it is that app's _single permitted effects module_ — a property
`effect-isolation.test.ts` enforces by asserting that no other module under `apps/studio/src/` reads
the environment or the filesystem.

An MCP server therefore has three ways in, and two of them are unacceptable:

- **Duplicate the logic.** 🚫 Refused. This repo's most frequently restated rule is that a fail-closed
  rule with two copies drifts, and _the copy that gets relaxed still passes its own tests_. It is why
  `assertOperatorFilePathOutsideRepository`, `describeJsonParseFailure`, `driverFailureLabelOf` and
  `askEntitlement` each have exactly one implementation with a guard.
- **Import across apps.** 🚫 Refused. `apps/mcp` importing `apps/studio/src/server/*` makes a Next.js
  app a library, drags its build into a CLI bundle, and makes the console undeployable-by-accident in
  the same motion.
- **Extract the workspace into a package both surfaces consume.** ✅ The only honest option.

---

## 2. Decision

### D1 — There will be a local MCP surface, and it is a CLIENT of AGE, not a host of it

AGE gains an MCP server that runs **on the operator's own machine**, speaking **stdio** to a locally
running Claude. It exposes the operator workspace as tools.

🚫 **IT BINDS NOTHING.** No port, no socket, no HTTP, no loopback listener — **stdio only**. This is
strictly stronger than ADR-0057 D2's loopback bind: a loopback listener can be reached by anything
else on the machine and tunnelled off it, whereas a stdio child process is reachable only by its
parent. ⚠️ **Do not "add an HTTP transport for convenience."** That is not a transport change; it is
the hosted shape arriving without ADR-0061.

### D2 — The workspace is extracted into `@age/operator-workspace`, and there remains exactly ONE implementation

The nine operations move out of `apps/studio/src/server/operator-environment.ts` into a package both
surfaces consume. The package is **pure orchestration over an injected runtime**, in the shape
`apps/capture` already proves works (`runCli(argv, runtime)`).

- `apps/studio` keeps `operator-environment.ts` as its **effects provider** — the one module that
  supplies the real filesystem, environment and clock — and its `effect-isolation.test.ts` guard
  stays **unchanged and passing**.
- `apps/mcp` supplies its **own** effects module, and gets its **own** copy of that guard.
- 🚫 **A guard asserts the orchestration exists in exactly one place**, in the manner of
  `@age/operator-file-policy` and `@age/entitlement`.

⚠️ **THE CONSOLE'S BEHAVIOUR MUST NOT CHANGE.** This is an extraction, not a redesign. Every shipped
refusal in slices 1–8 and ADR-0059 D6 survives it verbatim — including that `detectContradictions`
has no import path from the console, that a NON-ADOPTER is `not-assessed` and never "not ready", and
that a skip is a third state absent from the answer file. 🚫 A screen that renders differently after
the extraction is a defect, not an improvement.

### D3 — The tool surface is the three action classes, and Business Execution is still refused

ADR-0057 D4's classes govern the MCP tools exactly as they govern the screens:

- ✅ **Platform Administration** — create a client record, list businesses, resolve scope.
- ✅ **Knowledge Authoring** — read/write a discovery draft, submit answers, generate the BIF from the
  answer file, assemble evidence, report contradictions, assess readiness.
- 🚫 **Business Execution — REFUSED, not postponed.** No tool sends an email, publishes anything,
  calls an external system or acts on a business's behalf. ⚠️ A "preview" or "dry run" tool is still
  class 3 (ADR-0057 D4). 🚫 A tool named `execute_*` must not exist.

### D4 — The tools inherit every refusal, and MUST NOT smooth any of them for the model's benefit

🛑 **This is the decision most likely to be undone, because the pressure is real and sounds helpful.**
A model consuming a tool result prefers total, tidy, machine-shaped answers. AGE's answers are
deliberately none of those things.

- 🚫 `not-assessed` is returned **with its reason**, never as `null`, `0`, `false`, `"none"` or an
  omitted field. An epistemic state that serialises to a falsy value **will** be read as a negative
  finding by the next thing that touches it.
- 🚫 A tool must never return a clean bill of health AGE did not compute. **Absence is a limitation,
  never negative evidence** (ADR-0026 D4), and _"AGE has never looked"_ must not render as _"AGE
  checked and it is sound."_
- 🚫 Readiness stays a **separate named tool**, never a gate on a run tool (ADR-0027).
- 🚫 The four scores stay four (ADR-0054 D7) — 🚫 never combined into one number because one number
  is easier for a model to sort on.
- 🚫 A refusal names a **position**, never record contents, and never another client's id
  (ADR-0054 D3). ⚠️ A tool error is read by a model that may quote it back; it must carry no client
  name.

### D5 — The operator principal is still caller-asserted, and MCP does not change that

`OperatorPrincipal` remains provenance, never authorization (ADR-0053 D4). The MCP client asserts it;
AGE believes it. 🚫 There is no `operatorPrincipalOrDefault`, no principal derived from the process,
the hostname or the environment, and 🚫 the MCP server must not generate one.

⚠️ **This is honest ONLY because the transport is stdio and the machine is the operator's.** The
moment a transport admits a second party, a caller-asserted principal becomes a caller granting
itself access by naming itself — which is `askEntitlement`'s refusal (ADR-0058 D2), and which is
ADR-0061's problem, not this ADR's.

### D6 — The database stays the operator's own, and `assertLocalDatabaseTarget` is untouched

🚫 **No relaxation, no `allowRemote` flag, no second function, no exemption for MCP.** ADR-0055 D6's
five conditions apply unchanged. ⚠️ Its comments already name the exact evasion this ADR's context
invites — **an SSH tunnel from `localhost:5432` to a shared server is loopback and is precisely what
D6 forbids** — and 🚫 a VPS running the AGE database is that scenario with the tunnel made explicit.

### D7 — No model call enters AGE, ever, and the purity guards stay

🚫 The MCP server calls no model. It is a **server**, and Claude is its client. AGE's side stays
deterministic and pure, and the guard lists containing `openai` and `anthropic` stay in place.

⚠️ **This is what makes "no API key" coherent rather than a compromise** — the same reasoning the
Product Owner gave for RankOps, and it holds more strongly here because AGE has nothing to generate.

### D8 — What this acceptance authorizes, exhaustively

1. **`@age/operator-workspace`** — the nine operations extracted, pure over an injected runtime, with
   a single-implementation guard. The console consumes it; **its behaviour does not change**.
2. **`apps/mcp`** — a stdio MCP server exposing the class 1 and class 2 tools, its own effects module,
   its own effect-isolation guard, no listener.
3. **ADR-0061** — the hosted/SaaS shape written as `Status: Proposed`, 🚫 **not** implemented.

🚫 **Nothing else.** Not hosting, not identity, not a session, not a network transport, not a remote
database, not `apps/web`, not a caller for `@age/entitlement` (which still has none, deliberately, and
two guards assert it).

---

## 3. Consequences

**What the operator gets.** The RankOps feel — Claude as the interface, no key, no hosting bill —
with the data on their own machine. Assisted intake at full strength: hand Claude a brief, get
proposed answers, accept them one at a time.

**What they give up.** Access from another machine. ⚠️ That is real, and it is the thing ADR-0061
exists to price. 🚫 It must not be worked around by any transport, tunnel or convenience flag.

**The risk this ADR creates.** The extraction (D2) touches a 926-line module that eight shipped
slices depend on, and §3's "no broad refactors" exists for good reason. ⚠️ The mitigation is that the
extraction is **behaviour-preserving by construction** and the console's existing tests are the
acceptance criterion. 🛑 If the extraction cannot be done without changing a screen, **stop and write
an ADR** rather than changing the screen.

---

## 4. Alternatives considered

**Host `apps/web` publicly as a showcase.** Legitimate and safe — the demo is fixtures, no real
client is in it. 🚫 Not chosen: the Product Owner wants to _operate_, not to _show_, and a public
demo does not move that forward. ⚠️ It remains available and is not refused by anything.

**Put the MCP server on a VPS now and tunnel to it.** 🚫 Refused by D6 and by ADR-0055 D6's existing
comments. It is the hosted shape with the precondition skipped.

**Skip the extraction; let `apps/mcp` import `apps/studio`.** 🚫 Refused by D2's reasoning.

**Do nothing until ADR-0061 is accepted.** 🚫 Rejected: it makes the useful, unblocked work wait on a
decision the Product Owner explicitly deferred, which is the opposite of what §0.2 asked for.

---

## 5. Recorded, not authorized

⚠️ **This section is NOT a to-do list.** Each needs a fresh `Status: Proposed` ADR, read in its own
words (the standing rule since ADR-0049 §5).

- A **prompt/resource** surface on the MCP server, as distinct from tools.
- Tools that **read the capture store** — 🛑 blocked by ADR-0055 D7, which is still undischarged.
  🚫 **DO NOT SEED A ROW.**
- A **strategy** tool — `@age/strategy-intelligence-engine` exports zero functions and needs an
  engine, its own slice and its own ADR first.
- Any **caller** for `@age/entitlement`.

---

## 6. Open questions

1. **Does the MCP server expose `onboard` (the ADR-0054 D6 write path) as a tool?** It is the one
   class 2 operation that performs the capture write, and 🛑 **ADR-0055 D7 has still never happened** —
   the operator's own first run. ⚠️ The architect's position is that the **first** such write must be
   the operator's deliberate CLI invocation, not a model-initiated tool call, precisely because a
   tool call is easy to make by accident. **Unanswered; the tool is omitted until it is answered.**
2. **What does a tool return when the operator's file path is unset?** ADR-0054 D2 refuses a default,
   so the honest answer is a refusal naming the missing setting — but a model may retry a refusal in a
   loop. Whether AGE should say "and I will not answer this again" is undecided.
3. **Is the MCP server's own effects module a second `operator-environment`, or is the runtime itself
   extracted too?** D2 says each surface supplies its own. ⚠️ If that produces two near-identical
   effects modules, the duplication rule applies to _them_ and the answer changes.

---

## 7. Record

Proposed and accepted in the same exchange of 2026-08-08 — the architect set out the two halves of
the RankOps design and their separate answers; the Product Owner chose the local half and deferred
the hosted half by name (§0.2). 🚫 **NOT self-accepted.**

⚠️ The bounds in §0.2 and §0.3 are the acceptance. 🚫 Terseness is not breadth.
