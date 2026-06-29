# Specification First Development (SFD)

> Permanent engineering rule. Applies to every implementation EPIC from Phase 2 onward.
> This rule governs the relationship between specification and code in AGE.

---

## Rule

**Every architectural decision is made before code is written. Never in the middle of
implementation.**

---

## EPIC Sequence (mandatory)

Every implementation EPIC follows this sequence without exception:

```
ADR (if needed)
      ↓
Implementation Plan
      ↓
Feature Branch
      ↓
Implementation
      ↓
Tests
      ↓
Architecture Review
      ↓
Merge
```

No step may be skipped. No step may be reordered.

---

## What to do when implementation uncovers a missing architectural decision

If coding reveals a question that the frozen specification does not answer:

1. **Stop implementation immediately.**
2. **Write or update an ADR** — even a short one that simply states the decision.
3. **Get approval** (Product Owner or designated architect).
4. **Continue coding** — now with a resolved, recorded decision.

This preserves the integrity of `specification-freeze-v1.0` and every freeze tag that follows.

**Do not resolve architectural questions informally in code.** Code that encodes an
unrecorded architectural decision creates hidden coupling that cannot be reviewed,
reversed, or explained.

---

## Pull Request Review Contract

Every pull request is reviewable against exactly two questions:

1. **Does it conform to the frozen specification?**
   - If no → fix the code, not the specification.
2. **Does it require a new ADR?**
   - If yes → the ADR comes first. Stop, write the ADR, get approval, then continue.

These two questions replace subjective code review. If a PR passes both, it is
architecturally sound.

---

## Separation of concerns

| Change type                  | Artifact required                             |
| ---------------------------- | --------------------------------------------- |
| New capability               | New ADR                                       |
| Product behavior change      | Product Bible update (Product Owner approval) |
| Architectural change         | ADR + architecture document update            |
| Implementation detail        | Code only — no documentation change required  |
| Bug fix within spec boundary | Code only                                     |
| Deviation from frozen spec   | Not permitted without ADR + PO approval       |

---

## What "frozen" means in practice

- **`specification-freeze-v1.0`** is the authoritative starting point for all implementation.
  Do not edit it casually.
- Future changes are intentional and traceable:
  - Architectural change → ADR first, then architecture document update.
  - Product behavior change → Product Bible document update with Product Owner approval.
  - Implementation detail → code only; the specification does not change.
- The specification is a **contract**, not a suggestion. Code is reviewed against it.

---

## Why this rule exists

Until `specification-freeze-v1.0`, the primary artifact was documentation.
From now on, the primary artifact is code.

The documentation becomes the contract.

The discipline that produced a coherent, validated specification — freezing before expanding,
validating before assuming, separating product decisions from implementation decisions — must
be carried into implementation. SFD is that discipline applied to code.

---

## Scope

- Applies to every feature branch, every EPIC, every capability build from Phase 2 onward.
- Applies to all contributors.
- Cannot be waived for velocity. A missing ADR is never a "we'll document it later" situation.

---

## Reference

- `docs/reviews/SPECIFICATION_VALIDATION_REPORT.md` — what was validated
- `docs/reviews/SPECIFICATION_FREEZE_COMPLETION_REPORT.md` — what was frozen
- `docs/reviews/MILESTONE_HISTORY.md` — full milestone record
- `docs/adrs/` — all architectural decisions
