# ADR-0054 — The first real client

Status: Accepted
Date: 2026-08-02
Relates to: ADR-0026 D4 (missing sections are limitations, never negative evidence), ADR-0046 D5
(RLS is coherence, not authorization) and **D7 (no capture writes — this ADR proposes the first
conditional exception, D6 below)**, ADR-0049 D2 (no default parameter), ADR-0050 D1–D8
(`buildProfileFromAnswers`, still without a caller), ADR-0051 (the questionnaire pins
`Offering.type`), ADR-0053 D3/D4/D5 (the client registry, the operator principal, the required
`clientContext`), Product Bible Doc 11 §2.1/§2.1.1/§6.1, Doc 12 §6.1, Doc 13 §3.1 (all amended by
PR #209 and #211).

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by the mandate
the user gave on 2026-07-30. 🚫 **This ADR was `Status: Proposed` and was NOT self-accepted** — the
Product Owner accepted it, verbatim, in §0.1b. Three of
its decisions are the user's own, quoted verbatim in §0.2, and the remainder turn on a boundary
(ADR-0046 D7) that was set to protect data the architect cannot inspect. The user accepts or rejects.

### 0.1b Acceptance — ⚠️ NOT self-accepted

**The Product Owner accepted this ADR on 2026-08-02**, in their own words, reproduced verbatim:

> Accepted.
>
> D1–D8 are approved.
>
> D6 is accepted with the understanding that it is a conditional permission, not a general
> authorization for persistence.
>
> Writing a Scored BIF snapshot to a database is permitted only when all of the following are true:
>
> ClientContext is derived from a validated client record.
> The target database is operator-controlled and local.
> Persistence is explicitly requested by the operator.
> produceOnly remains the default execution mode.
> No background execution, scheduling, or automation is introduced by this slice.
>
> ADR-0046 D7 is not repealed; it remains the default rule outside these conditions. This slice
> authorizes only the narrow local persistence required to complete the onboarding workflow.

The Product Owner also supplied the **framing** for D6, recorded here because it is the reason the
decision is coherent rather than a reversal:

> The important point is that D6 is not introducing a new architectural direction—it is discharging
> a safety condition that earlier ADRs deliberately postponed.
>
> ADR-0046 prohibited persistence because the system could not trust the identity attached to a
> snapshot. ADR-0053 established a trusted identity source through the client record. ADR-0054
> therefore allows persistence only after that prerequisite is satisfied. That's a coherent
> evolution of the architecture rather than a reversal.

⚠️ **A fifth condition is added by this acceptance and binds as if it were written into D6:**
**no background execution, scheduling, or automation is introduced by this slice.** The four
conditions already stated in D6 constrain _where and when_ a write may happen; this fifth one
constrains _who triggers it_ — it must be the operator, in the foreground, every time.

### 0.1c The dissents stay, and the Product Owner said why

Both upheld dissents were **explicitly affirmed** rather than waived:

> Wrong questionnaire answers — This is an inherent limitation of manual onboarding. Validation can
> ensure structure and completeness, but it cannot determine whether a human's business answer is
> correct.
>
> Hub-and-spoke enforcement — AGE can enforce that it never chains peer products together. It
> cannot mechanically prevent RankOps from later calling MCP Ads internally. That remains an
> architectural governance rule across products rather than something AGE alone can enforce.

🚫 **Do not delete, soften or mark these dissents as mitigated.** The second one in particular
bounds what D5's guard is allowed to _claim_: the guard is evidence about **this repository only**,
and must never be described as proving anything about a peer product's own code.

### 0.1d The stopping point, set by the Product Owner

> Proceed with the implementation slice exactly within ADR-0054's accepted boundaries. Do not
> expand the scope beyond the documented local persistence workflow. Preserve produceOnly as the
> default. Do not introduce automation, scheduling, or production runtime wiring. Stop after the
> first end-to-end local onboarding flow is complete and documented.

⚠️ **"Stop" means stop.** The first true runtime caller is the **next** architectural phase and is
**not** authorized by this ADR. When the local onboarding flow runs end to end and is documented,
the correct next action is a checkpoint and a fresh `Status: Proposed` ADR — not the next slice.

### 0.2 The decisions the user already made, verbatim

Three positions below are **not** the architect's and are recorded as the user's:

> _"a) is ok"_ — answers arrive as a **file the operator edits**, not an interactive prompt (D1).

> _"mcp-ad-server will be ads execution layer"_ (D4).

> _"i also want hub and spoke only, and no tools should interact with each other"_ (D5).

⚠️ The Product Bible was amended to carry the second and third before this ADR was written (Doc 11
§2.1.1 rule 4, Doc 12 §6.1 constraint 4). **This ADR does not re-decide them**; it records what they
oblige the code to do.

### 0.3 No council was convened

⚠️ Stated plainly because §2 of the working memory would otherwise imply one. The dissents in §4 are
the architect's own adversarial analysis, **not** independent lenses, and must not be cited as
independent confirmation (finding 7: prose launders one's own errors back as agreement).

---

## 1. The defect

**Not one real business has ever passed through AGE.** ~200 merged PRs, six capabilities, a frozen
architecture, a demo surface, a persistence layer with row-level security — and every one of them is
fed by `SAMPLE_BUSINESS_DISCOVERY_PROFILE`, a single frozen literal.

The specific consequences, each independently verifiable today:

1. **`buildProfileFromAnswers` has no caller** (ADR-0050, shipped in #194). The one function that
   turns answers into a profile has never been asked to do so.
2. **No answers exist.** `DiscoveryAnswer` is a well-formed type with no instance outside tests.
3. **No profile has ever been stored.** The capture chain exists end to end and
   `produceAndCapture` **has never run** (ADR-0046 D7).
4. **The registry has no real record.** `@age/client-registry` shipped in #208 with fictional
   fixtures only (ADR-0053 D3).

⚠️ **This is the fifth consecutive slice-shaped observation and it is now the binding one.** ADR-0053
dissent 2 set the ceiling in terms this ADR must satisfy or fail:

> **the next slice must make an actual client's answers produce an actual stored result.**

🚫 **A slice that produces another well-typed surface with no instance behind it does not discharge
that ceiling**, however clean it is.

### 1.1 What is genuinely blocking, and what only looked blocking

| Blocker cited in earlier slices                 | Status now                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| "No way to name a real client"                  | **Resolved** by ADR-0053 D1/D2 — `ClientRecord` → `toClientContext`               |
| "No principal to attribute the act to"          | **Resolved** by ADR-0053 D4 — `OperatorPrincipal`, unverified but true            |
| "`clientContext` is hardwired to the demo"      | **Resolved** by ADR-0053 D5 — required parameter, no default                      |
| "Real client data cannot be committed"          | **Not a blocker** — it is a constraint on _where the file lives_, not on building |
| "No authentication"                             | **Genuinely open** — and D8 keeps this slice inside the single-operator ceiling   |
| "Writing a snapshot is forbidden" (ADR-0046 D7) | **The real blocker.** D6 addresses it directly rather than routing around it      |

## 2. Decisions

### D1 — Answers arrive as an operator-authored file, never an interactive prompt

A real client's answers are supplied as a **JSON file the operator edits**, parsed and validated into
`readonly DiscoveryAnswer[]`.

- 🚫 **No interactive terminal questionnaire, no web form.** The operator drives everything from a
  terminal (ADR-0053 D6) and a file is re-runnable, diffable and correctable; an interactive session
  discards its own input the moment it ends. ⚠️ ADR-0052/PR #205 was withdrawn for precisely this.
- The file is **read-only input**. Nothing writes back to it, and no default is supplied for a
  missing answer — an unanswered question is **absent**, never an empty string (ADR-0026 D4).
- Parsing is **fail-closed and total**: an unknown `questionId`, a `value` whose shape contradicts the
  question's `kind`, or a malformed file is a **refusal with the offending id named**, never a
  silently dropped answer. ⚠️ A dropped answer would raise the completeness score of a profile that
  is missing data — the exact failure mode ADR-0051's erratum exists to prevent.

### D2 — The answer file lives outside the repository and is never committed

🚫 **The repository is PUBLIC.** The answer file contains a real business's positioning, offerings,
customers and goals.

- Its path is a **required parameter** supplied by the operator at run time. 🚫 No default path, no
  fallback location, no search of the working directory — a default would eventually resolve to
  something and load a file nobody chose.
- A path inside the repository working tree is **refused**, not warned about.
- ⚠️ **`.gitignore` is not the control** — it protects only paths someone remembered to list. The
  control is that the file lives outside the repo entirely and the code refuses paths inside it.
- 🚫 **The fixtures stay obviously fictional** (ADR-0053 D3). Do not "make them realistic" to test
  this path; obvious fictionality is the guard that a fixture never gets mistaken for a real record.

### D3 — The real `ClientRecord` is loaded from a local file, by the same rules

`@age/client-registry` gains a **loader**, not new fixtures. Same constraints as D2: caller-supplied
path, outside the repo, fail-closed parsing, no default.

- 🚫 **Client names and external account ids never enter the repository** — not in a fixture, not in
  a test, not in a commit message, not redacted or masked (ADR-0053 D3).
- 🚫 **`findClientRecord` on an unknown id returns `undefined` and the run refuses.** It must never
  fabricate a record, because a fabricated record produces a scope that names nothing and — under D6 —
  that scope reaches a database.

### D4 — mcp-ads-server is the ads Execution Layer (the user's decision)

Ads execution is **delegated to mcp-ads-server as a peer product** (Doc 11 §2.1.1, Doc 12 §6.1).
🚫 **AGE does not build its own ads execution.**

- AGE produces an approved plan; the **handover is the execution operation**, gated by approval,
  scoped to one client, audited (Doc 12 §6.1).
- 🚫 **AGE never holds a Google Ads credential** — credential locality (Doc 11 §6.1): credentials are
  owned only by execution surfaces; AGE stores references, never secrets.
- 🚫 **AGE never claims the spend as its own act.**
- ⚠️ **No mcp-ads code, call, or adapter is in this slice** (D8). D4 fixes the direction so that
  nothing built here forecloses it — specifically, it is why `externalRefs` stays an **open map** and
  why no ads execution surface is scaffolded inside AGE.

### D5 — Hub and spoke, enforced rather than described (the user's decision)

🚫 **No peer product ever calls another peer product. Cross-product insight is produced only by AGE
reasoning over a shared BIF.**

- Each peer product contributes what it observes as **Evidence** and **reads nothing about the
  others**. The conclusion lives where the whole client is visible, which is AGE and only AGE.
- 🚫 **A handover never chains** (Doc 12 §6.1 constraint 4): a second hop would execute outside AGE's
  approval, scope and audit while still appearing to be part of an approved plan.
- ⚠️ **This is enforced by a guard test in this slice, not merely documented.** Direct wiring would
  grow to N² connections and let two tools take an independent decision — the failure AGE exists to
  prevent. Documentation alone has not previously been sufficient (finding: a guard is evidence only
  once it has been made to fail).

### D6 — One real snapshot may be written, to a local database, under stated conditions

⚠️ **This is the only decision in this ADR that relaxes an existing refusal, and it is the reason the
ADR is `Proposed`.**

ADR-0046 D7 forbids `produceAndCapture` against **any durable database**, because a mis-scoped row is
uncorrectable and invisible to the tenant that should have received it. That reasoning was correct
**and its premise was the identity gap** — scope came from a fabricated or hardwired context, so
"mis-scoped" was the likely case, not the unlikely one. ADR-0053 D1–D5 closed that gap.

D6 therefore permits **exactly one narrow case**, and every clause is load-bearing:

1. The scope comes from a **`ClientRecord` loaded per D3** — never fabricated, never defaulted.
2. The target is a **local development database the operator controls**. 🚫 **Not production, not
   shared, not any database another tenant's data has ever touched.**
3. The run is **explicitly requested** with the real target named. 🚫 No default mode, no fallback
   from `produceOnly`, no inference.
4. Refusing is always available and always safe: **`produceOnly` remains the default** and opens no
   connection at all.
5. ⚠️ **Added by the acceptance (§0.1b) and binding as if written here: no background execution, no
   scheduling, no automation is introduced by this slice.** Every write is operator-triggered, in
   the foreground.

🚫 **ADR-0046 D7 remains in force everywhere else and is NOT repealed.** D6 is a **conditional
permission, not a general authorization for persistence** (§0.1b) — outside these five conditions
ADR-0046 D7 is still the rule, unchanged.

⚠️ **Why this is not a reversal** (the Product Owner's framing, §0.1b): ADR-0046 prohibited
persistence because the system could not trust the identity attached to a snapshot; ADR-0053
established that trusted identity through the client record; D6 permits persistence **only after
that prerequisite is satisfied.** The condition was discharged, not waived.

⚠️ The "if the user rejects D6" branch below is now **moot — D6 was accepted.** It is left in place
because the record should show what the alternative was: the rest of the ADR would still have stood,
slice B would produce a profile the operator can read but not a stored one, and **the ADR-0053
dissent-2 ceiling would NOT have been discharged.**

### D7 — The falsification test is stated in advance

The slice **succeeds** if and only if: a real client's answers, in a file outside the repository,
produce a stored scored-BIF snapshot under a scope derived from a real `ClientRecord`, which the
operator can then read back.

⚠️ **Stated before implementation on purpose.** Every previous slice on this line could be declared
successful after the fact because success was never defined in advance.

🚫 **The demo baseline must not move**: **98/63 intake vs 12/17 BIF**, band `strong`, 7 populated + 5
omitted, `sample-output.txt` byte-identical. A real client's data flowing through a **separate** path
must leave the frozen sample path untouched; if it moves, the two paths are entangled and the change
is wrong.

⚠️ **A low score for the real client is a CORRECT result, not a defect** (ADR-0026 D4, ADR-0051's
cap). 🚫 Do **not** "help" the first real profile by touching a cap, a weight or a predicate. The
first honest number is the most valuable output of this entire slice.

### D8 — What this slice does not touch

🚫 No authentication · no second human · no API or Web surface · no mcp-ads or RankOps call of any
kind · no execution, no ad spend, no external request · no BIF status promotion · no schema or
migration change · no `Client` aggregate (ADR-0009 stays reserved) · no RLS change · no capability
change.

⚠️ **Dissent 1's ceiling from ADR-0053 is unchanged and binding:** the first slice that lets a
**second person** act, or that exposes AGE beyond the operator's terminal, **must build
authentication first.** D6 stays inside it by permitting only a local database the single operator
controls.

## 3. What this deliberately does not claim

- **It does not claim AGE is integrated with anything.** D4 fixes a direction; it builds no
  connection. ⚠️ **Naming is not reachability** — do not report mcp-ads as integrated.
- **It does not claim the stored snapshot is multi-tenant-safe.** RLS is **coherence, not
  authorization** (ADR-0046 D5) and gives zero isolation between two tenants on the same role. One
  operator, one local database, one client is the entire claim.
- **It does not claim the profile is good.** It claims the profile is **real** — the first output in
  AGE's history whose content was not authored by the person building AGE.
- **It does not claim the method is validated.** ⚠️ That verdict belongs to the user after reading
  the first real output. If the stored profile is not something the user finds useful, the correct
  conclusion is that **the method is wrong, not that the next slice should be bigger.**

## 4. Dissents, recorded not dissolved

⚠️ Per §0.3 these are the architect's own adversarial analysis, not independent lenses.

**Dissent 1 — D6 relaxes a refusal that was written to protect exactly this situation.**
ADR-0046 D7's author did not have the identity gap in mind as its sole premise; "a mis-scoped row is
uncorrectable" is true regardless of why the scope is wrong, and a loader can produce a wrong scope
just as a fixture can. **Partially upheld.** The mitigation is the local-database clause, not the
loader: a wrong row in a database only the operator has is correctable by dropping it. 🚫 The moment
the target is anything shared, D6 does not apply and ADR-0046 D7 governs unchanged.

**Dissent 2 — a JSON file is a worse questionnaire than the questionnaire.**
`DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` has sections, weights, kinds and enums; a hand-edited file
throws that structure away and makes the operator the validator. **Upheld in part** — which is why D1
requires validation **against the questionnaire**, rejecting unknown ids and shape mismatches rather
than accepting free-form JSON. ⚠️ It remains true that the operator can answer a question wrongly and
nothing will notice. That is a limitation of the slice, not a defect of the design, and it is the
price of not building a form.

**Dissent 3 — vTEST is the operator's own test client, so "a real business" overstates it.**
Genuine. The answers will be real, but the client is one the operator controls and is unusually
tolerant of a bad result. ⚠️ **Deliberately left open**: the honest test is whether the output is
useful, and the user is the only one who can judge that (§3, last bullet).

**Dissent 4 — D5's guard cannot actually detect what it claims to.**
A repo-scan guard inside AGE can prove that AGE's own source does not wire two peer products
together; it cannot prove that mcp-ads never calls RankOps, because that code is not here.
**Upheld and not mitigated.** The guard's scope must be stated honestly in its own test name and in
the checkpoint: it enforces hub-and-spoke **within AGE**, and the constraint on the peer products
themselves is a product commitment (Doc 11 §2.1.1 rule 4), not a mechanically enforced one.

## 5. Recorded, NOT authorized

⚠️ **This section is not a to-do list.** Each item needs its own `Status: Proposed` ADR.

1. A reader that shows a stored snapshot back to the operator beyond the minimum D7 requires.
2. The first real evidence flowing **inbound** from a peer product into a client's BIF.
3. Any mcp-ads handover, including a dry-run one.
4. Authentication, and with it the second human (ADR-0053 dissent 1).
5. Trend or comparison across two snapshots of the same client.
