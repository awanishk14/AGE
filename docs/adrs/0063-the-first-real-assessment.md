# ADR-0063 — The first real assessment

- **Status:** Accepted
- **Date:** 2026-08-08
- **Supersedes:** nothing
- **Superseded by:** nothing
- **Related:** ADR-0026 (context assessment), ADR-0027 (readiness is not a gate), ADR-0046 D5/D7,
  ADR-0053 D4/D5, ADR-0054 D6/D7, **ADR-0055 D8 (which fixes this slice)**, ADR-0055 §5 item 2
  (which withholds authorization for it), ADR-0057 D4 (action classes)

---

## 0. How this decision was reached

### 0.1 Acceptance is the architect's, under a standing grant

This ADR is **self-accepted** under the standing mandate recorded in the operator's working memory,
quoted verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

⚠️ **This is NOT a claim that the Product Owner reviewed these decisions.** They did not. The grant
covers architectural and sequencing decisions; it does not cover the hard boundaries, and this ADR
crosses none of them. ADR-0043 §0.1 is the precedent for the form.

🚫 **What this self-acceptance may NOT be cited for later:** it does not extend to identity, to a
second human, to a network listener, to a hosted surface, or to any class-3 action under ADR-0057
D4. Those remain the Product Owner's, and ADR-0062 D5 leaves them untouched.

### 0.2 Why an ADR is needed at all

ADR-0055 **D8** states the next slice in mandatory terms — _"the slice after this one must feed a
capability from a real stored context instead of a fixture"_ — but ADR-0055 **§5 item 2** lists the
same work under _"Recorded, NOT authorized"_ and says D8 _"sets the ceiling; it does not authorize
it"_. Both are correct and they are not in conflict: D8 fixes **which** slice comes next and
forbids the alternatives, and §5 requires the slice to be **described before it is built**. This
ADR is that description.

---

## 1. Context

### 1.1 What is true on `main` today

- **One real snapshot row exists** (ADR-0055 D6/D7, discharged 2026-08-08): a real business's
  answers, scored, stored under a scope derived from a real `ClientRecord` — **confidence 14 /
  completeness 11**, 6 sections present, 6 omitted, `Draft`.
- **`age-capture inspect` (#260) reads that row back and prints it.** It renders no assessment, by
  ADR-0055 D4.
- **Nothing in AGE has ever reasoned over real data.** Every capability run, every readiness report,
  every screen, in the entire history of this repository, has been fed a fixture. That is the gap
  D8 names, and it is the only gap on this line that a slice can close.

### 1.2 The finding that shapes every decision below

⚠️ **No capability's `run` accepts a `ScoredBifContext`, and none can be made to.** Verified against
`main`:

| Capability                         | `run` input            | Accepts a context? |
| ---------------------------------- | ---------------------- | ------------------ |
| `@age/capability-authority`        | `AuthorityInput`       | no                 |
| `@age/capability-growth`           | `GrowthInput`          | no                 |
| `@age/capability-intelligence`     | `EvidencePackage`      | no                 |
| `@age/capability-market-discovery` | `MarketDiscoveryInput` | no                 |
| `@age/capability-operations`       | `OperationsInput`      | no                 |
| `@age/capability-revenue`          | `RevenueInput`         | no                 |

**Three of the six** expose a second, separately-named entry point that _does_ take a
`ScoredBifContext` — `assessScoredBifContext`, `assessMarketContextReadiness`,
`assessRevenueContextReadiness` — which is exactly the ADR-0027 shape: readiness as a named entry
point, **never a gate on `run`**.

There are therefore only two ways to satisfy D8 literally, and one of them is forbidden:

1. **Build an adapter from `ScoredBifContext` to a capability's `Input`.** 🚫 **Refused.** A stored
   context does not contain an `EvidencePackage` or a `RevenueInput`; an adapter would have to
   **invent** the fields it lacks. §3's hard boundary — _"never fabricate provenance, scores,
   sections or conclusions"_ — forbids it, and ADR-0055 D8 independently refuses "a new engine".
   ⚠️ It would also produce exactly the failure the dissent warned about: a capability returning a
   confident result on data that never justified it.
2. **Call the three assessors that already take a context.** This is what the projection was built
   for, and it is what this ADR authorizes.

⚠️ **D8's wording is therefore satisfied by the assessors, not by `run`.** Recorded plainly rather
than quietly reinterpreted: a future reader comparing D8's word _"capability"_ against this slice's
`assess` will otherwise conclude the slice fell short of its own ADR. It did not; `run` was never
reachable from a context and D8's author did not have that constraint in front of them.

---

## 2. Decisions

### D1 — A new `assess` subcommand, and 🚫 NOT a change to `inspect`

`age-capture assess` takes the same scope flags as `inspect` (`--records`, `--repository-root`,
`--client-id`, `--bif-id`, optional `--snapshot-id`), loads the stored row, and runs the three
context assessors over it.

🚫 **`inspect` is NOT extended, and ADR-0055 D4 is NOT repealed.** D4 refused readiness _inside the
printer_, so that a command whose job is "show me what was stored" could never start editorialising
about it. That reasoning is still right. A separate command, whose entire declared purpose is the
assessment, does not weaken it — the operator chooses which question they are asking.

⚠️ **Same reason `inspect` was a third dispatcher branch and not a `--read` flag:** a mode puts two
different questions behind one parser.

### D2 — It calls the three assessors DIRECTLY, and 🚫 never `buildContextReadinessReport`

`buildContextReadinessReport` already composes these three assessors — and it lives in
**`@age/demo-runtime`**.

🚫 **The real-client path must never import the demo runtime.** ADR-0054 D7 requires the demo
baseline to stay byte-identical and states the reason: _"if it moves, the two paths are entangled
and the change is wrong."_ An import is entanglement whether or not the bytes move today — the next
person to adjust the demo's readiness composition would silently change what a real client's
assessment says.

A guard asserts `@age/demo-runtime` appears nowhere in `apps/capture`.

### D3 — 🚫 No capability `run`, no adapter, no invented input

Per §1.2. The command calls three assessors and stops. 🚫 No `EvidencePackage` is constructed, no
`RevenueInput` is synthesised, and no capability's `run` is called from this path.

### D4 — The three capabilities WITHOUT an assessor are reported as `not-assessed`, 🚫 never as ready or unready

Authority, Growth and Operations expose no context assessor at all (no `assessesContext` in their
registry entries). The output names all six capabilities and says of those three:

> `not-assessed — this capability exposes no context assessor`

🚫 **Printing only the three that were assessed is refused**, and so is any wording implying the
other three are fine. This is the `detectContradictions` failure in a new place: a surface that
silently omits what it never examined turns _"AGE has never looked"_ into _"AGE looked and found
nothing wrong."_

### D5 — An ABSENT sufficiency prints as `not-stated`, 🚫 never defaulted to `ready`

`CapabilityOutput.sufficiency` is optional on the shared envelope. §5 of the non-negotiable
semantics is explicit: _"`sufficiency` omitted stays `undefined` — never default it to `ready`."_
The printer renders the absence as an absence.

### D6 — 🚫 NO AGGREGATE ACROSS CAPABILITIES

🚫 No score, no band, no "2 of 3 ready", no count of ready capabilities, no ordering by state, no
overall verdict. Each assessor's state and **its own reasons** are printed under its own heading.

⚠️ An aggregate over three assessed and three not-assessed capabilities is not merely unhelpful —
it is **arithmetic over a value that does not exist**, and it would read as a measurement of the
business.

### D7 — It reuses the ADR-0055 D2 read façade, and adds 🚫 NO new connection

The existing `SnapshotReadConnection` — two reads and a close, with the `append`-bearing repository
never escaping the composition function — is reused unchanged. 🚫 No new connection function, no
new export, and no path from this command to a write. ADR-0046 D7 is not repealed.

### D8 — `producedAt` is injected, never read from a clock inside the run

The assessors require a caller-supplied `producedAt` for determinism (ADR-0026 D2). It arrives
through the injected runtime, as every other effect in this CLI does. The run stays pure and the
clock stays in `main.ts`.

### D9 — The falsification test, stated in advance

The slice **succeeds** if and only if, run against the operator's own stored row:

1. all six capabilities are named, three with a real assessed state and three as `not-assessed`;
2. the assessed states are reported **with the assessors' own reasons**, whatever those states are;
3. the sections the real BIF omits are named as **limitations**, not as findings; and
4. `pnpm demo` is unchanged — **98/63 vs 12/17**, 7 populated + 5 omitted, `sample-output.txt`
   byte-identical.

⚠️ **`insufficient` IS A PASS.** A BIF at confidence 14 should not support a capability, and an
assessor that says so is working. 🚫 Do **not** touch a threshold, a cap, a weight or a predicate to
make the output look better — ADR-0054 D7 and ADR-0051's cap already say this, and this is the slice
where the temptation is strongest, because the number will finally be visible next to a real
business's name.

🚫 **A `ready` on this row would be evidence of a DEFECT**, not of success.

---

## 3. What this ADR does NOT claim

1. 🚫 **It does not claim AGE now produces value for a client.** It claims one honest assessment of
   real stored context, which is the first of its kind.
2. 🚫 **It does not authorize acting on the result** — no strategy, no proposal, no execution, no
   recommendation. ADR-0057 D4's class 3 is untouched.
3. 🚫 **It adds no authentication and does not reduce the need for it.** ADR-0055 D9 stands
   unanswered.
4. 🚫 **No real client record, answer file, name or stored context is committed** — not redacted,
   not masked. Obvious fictionality is the guard (ADR-0053 D3).
5. 🚫 **It does not make readiness a gate.** ADR-0027 is untouched: `run` still does not consult an
   assessment, and this command still does not call `run`.

---

## 4. Consequences

**If accepted:** the persistence tier gains its first _reasoning_ consumer, and AGE's claim to
assess a business becomes falsifiable against one real business instead of six fixtures. The likely
first honest answer is "not enough context", which is the most useful output this repository has
produced.

**If rejected:** ADR-0055 D8 has no implementation, the stored row stays a thing that is printed
rather than used, and every assessment AGE can demonstrate remains a fixture.

---

## 5. Recorded, NOT authorized

⚠️ **Not a to-do list.** Each needs a fresh `Status: Proposed` ADR. **Next number after this one is 0064.**

1. Storing an assessment result — this command computes and prints; it persists nothing.
2. A Studio screen over the assessment. 🚫 ADR-0055 D1's "and no other surface" governs the read,
   and `apps/studio`'s effect-isolation guard bans the persistence packages outright.
3. Giving Authority, Growth and Operations a context assessor. ⚠️ That is three capability changes
   and ADR-0026's threshold question reopened; 🚫 do not do it to remove three `not-assessed` rows.
4. Acting on any assessed state, including "gather this context next" as an instruction rather than
   as the assessor's own reported hint.
5. ADR-0055 D9's entitlement function, and authentication.
