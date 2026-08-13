# ADR-0069 — the cross-system intelligence loop: checkpoint

> Extracted **verbatim** from `CLAUDE.md` §1 on 2026-08-13 (after #312), because that file crossed
> its 40k hard limit. 🚫 Nothing was dropped or reworded. Read this before undoing anything on the
> ADR-0069 track.

## #310 — the relay CLI (main `0a9adc3`)

> ✅ **#310 — THE RELAY CLI: `age-capture relay`, THE ONLY DOOR AN OBSERVATION ENTERS BY**
> (main `0a9adc3`, post-merge CI green, **15 steps**; `ci-db.yml` also ran, 18). D7 needed a second
> producer and there was **none**. This is the **OPERATOR'S OWN ACT**, out of band.
> 🛑 **THE ORDER IS THE ARGUMENT:** arguments → client record (an unknown client opens **NO**
> connection) → the observation as **untrusted** input → the scope check → the stored BIF →
> admissibility → **only then** an append handle. 🛑 **NOTHING BEFORE THAT CAN WRITE, AND NOT
> BECAUSE IT DECLINES TO** — the append connection is a **function on the runtime**, so a refusing
> or unconfirmed run never holds one; ⚠️ the suite asserts it by **COUNTING HANDLES OPENED**, 🚫 not
> by reading output. 🚫 **`--append` IS A DIFFERENT WORD FROM `--capture`** on purpose, and each
> half without the other is an error. 🚫 `--organization-id`, `--source-system`, `--subject`,
> `--observation-id`, `--recorded-at`, `--all`, `--directory` are refused **BY NAME** — "Unknown
> flag" reads as a typo. 🛑 **THE SOURCE'S `organizationScope` IS CHECKED AND NEVER USED** — a
> mismatch REFUSES rather than filing the row under the typed scope. 🛑 **`contextNotFound` IS ITS
> OWN EXIT CODE** — no stored context means the check **was never run**, 🚫 never `inadmissible`.
> ⚠️ The composition purity guard is now **BOUNDED TO ONE FUNCTION** (it had sliced to end-of-file),
> with a sibling guard on the write door. 🚫 ADR-0060 §6 Q1 STILL UNANSWERED.
