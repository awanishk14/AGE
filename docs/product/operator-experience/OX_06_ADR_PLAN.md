# Phase 6 — ADR Plan

> Every gap that needs governance, as a planned ADR. **🚫 No implementation before acceptance.**
>
> ⚠️ **The numbers below are indicative, not reserved.** A session's notes once said "next ADR is
> 0055" long after `0055-the-row-nobody-reads.md` was on `main`; writing 0056 as 0055 would have
> overwritten a `Proposed` ADR awaiting the Product Owner. 🚫 **Never take the next number from this
> file — run `ls docs/adrs/` first.**

---

## Governance, restated

A `Status: Proposed` ADR is a **decision request**. The precedent, unbroken across #88→#89 through
#221→#223: merge the Proposed PR to record it → the **Product Owner** accepts in their own words → a
**separate** PR flips `Status` with that note verbatim.

⚠️ **These ADRs are not self-acceptable.** The §2 architect grant covers decisions the architect can
reason to; it does not cover introducing a new surface, undoing a revert, or standing under a security
ceiling. ADR-0055 and ADR-0056 were both accepted by the Product Owner, and neither was self-accepted.

---

## ADR-0057 — The Operator Console and the loopback invariant

**Written and proposed with this program.** `docs/adrs/0057-the-operator-console.md`.

Decides: that a local operator surface exists at all · **OX-INV-1**, loopback by construction ·
that it performs no write the CLI cannot · that it is not a draft of Doc 07's product · the twelve
screens and the four refusal classes · that G-14 and G-15 are preconditions for anything non-loopback.

This is the gate. **Everything below is blocked on it.**

---

## The planned ADRs

| #     | Subject                      | Gap  | Blocked on                         | The decision it actually asks for                                                                                                                                                                                      |
| ----- | ---------------------------- | ---- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Snapshot read model          | G-1  | ADR-0057 + **operator's D6 write** | What a read connection is, such that it is _structurally_ incapable of writing. Already authorized in substance by ADR-0055 (`inspect`) — this ADR exists only if the console's read differs from the CLI's            |
| **B** | Console HTTP surface         | G-16 | ADR-0057                           | Which endpoints exist, and how OX-INV-1 is enforced and proven. Must state that a bind failure is a **startup refusal**, not a warning                                                                                 |
| **C** | Rendering-logic boundary     | G-17 | ADR-0057                           | Where screen logic lives given `jsdom` is absent. Likely "a package, per ADR-0048's precedent" — but the precedent must be extended deliberately, not assumed                                                          |
| **D** | Evidence ingestion adapter   | G-3  | A + B                              | The **first** adapter, and what it may set on an `Evidence` record. ⚠️ Must open by restating that ADR-0056 D1/D2 were **rejected** and 🚫 must not re-propose them as drafted                                         |
| **E** | Contradiction surfacing      | G-4  | D                                  | Whether the detector is fit to show an operator. 🚫 Must be made to fail on a known non-contradiction first                                                                                                            |
| **F** | Contradiction adjudication   | G-5  | E                                  | 🛑 **The hard one.** How a judgement is recorded in an append-only world that has no update, no delete and no `current` flag                                                                                           |
| **G** | Strategy engine wiring       | G-6  | G-2                                | How SIE is invoked and what its output's provenance is. ⚠️ Not a UI slice                                                                                                                                              |
| **H** | Peer product contract client | G-8  | ADR-0057                           | ⚠️ **Which peer first** — dissent 3 is open, and mcp-ads may beat RankOps. An owner decision, not an architect one                                                                                                     |
| **I** | Knowledge graph producer     | G-11 | D                                  | Whether BKG is fed from evidence, from the BIF, or retired                                                                                                                                                             |
| **J** | Entitlement function         | G-14 | —                                  | 🔴 **Independent of the console and more urgent than it.** The only producer of a `ClientContext` for persistence. ⚠️ ADR-0055 D9 records this as a ceiling, **recorded not scheduled**; this ADR is what schedules it |
| **K** | Authentication               | G-15 | J                                  | The first second-person surface. ADR-0053 dissent 1                                                                                                                                                                    |
| **L** | Execution re-introduction    | G-7  | J, K                               | 🛑 **Undoing a deliberate revert.** Must account for why PRs #41–#61 were reverted and what changed                                                                                                                    |
| **M** | Live onboarding flow         | G-13 | B                                  | Console-authored records, **outside the repo, never committed**                                                                                                                                                        |

**Not planned:** search (G-9), notifications (G-10), task queue (G-12). The latter two 🚫 conflict with
ADR-0054 D6 condition 5 and cannot be proposed while that relaxation is what permits capture at all.

---

## Ordering

```
ADR-0057
   ├── B ──┬── C ── (S2, S4, S13 buildable)
   │       └── M
   ├── A ── (S3, S5, S11 buildable) ── G-2 ── G ── (S9)
   ├── D ── E ── F ── (S6, S7)
   │        └── I
   └── H ── (S12)

J ── K ── L        ← independent track, and the one that actually gates the product
```

⚠️ **The J→K→L track does not depend on the console and should not wait for it.** It is the security
ceiling. The console being loopback-only is what makes deferring it _survivable_, not what makes it
_unnecessary_ — and every day the console makes AGE more useful is a day the pressure to expose it
grows.

---

## Stops requiring the owner, not the architect

Carried from Bible §10 and the gaps. Each is a genuine product decision:

1. **Does the console ever capture, or is it strictly read-only?** Read-only makes OX-INV-1
   dramatically easier to hold and removes an entire refusal class.
2. **Which peer product is first?** Dissent 3 is open by design.
3. **Is execution re-introduced?** The revert was deliberate.
4. **Does the answer file remain the author of record, or does the console replace it?**
5. **Is the knowledge graph fed, or retired?** It has been an orphan for a long time.
6. **When does the J→K→L track start?** ⚠️ This is the one with a wrong answer. Starting it _after_ a
   networked surface exists is the retrofit ADR-0055 D9 explicitly forbids.
