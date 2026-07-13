# AGE Capability Demo Runner

A tiny, self-contained CLI that runs AGE's six completed capabilities against
local fixtures and prints the **decision objects** each one recommends.

It exists to make the capabilities easy to see and understand without standing
up any infrastructure.

## What the demo does

The runner feeds a small set of in-memory fixtures through the six pure
capabilities and prints, for each one:

- a **counts line** — `accepted`, `rejected`, `duplicate`, and `derived`
  (`derived = accepted + rejected + duplicate`);
- an **accounting line** confirming `derived === input items`, so nothing
  disappears silently;
- the **accepted decision objects** (what a human would review);
- **rejected** items, surfaced with a reason code (never dropped silently);
- **duplicates**, showing which accepted original they merged into;
- a **PENDING HUMAN APPROVAL** checklist of everything awaiting sign-off.

A final summary reports how many capabilities ran, how many decision objects
are pending approval, and whether the accounting invariant held across all six.

## How to run it

From the repository root:

```bash
# via the root package script
pnpm demo

# or directly through Nx
pnpm nx run demo:run
```

Both commands run the exact same runner (`apps/demo/src/run.ts`).

## What the output means

Each capability produces a **recommendation**, not an action. The output is a
list of decision objects plus the items that were rejected or de-duplicated
along the way. The accounting line is a sanity check: every input item ends up
counted as exactly one of accepted / rejected / duplicate.

See [`sample-output.txt`](./sample-output.txt) for a full, committed example of
a run. The only field that varies between runs is the `createdAt` envelope
timestamp; every decision value is deterministic given the fixtures.

## Runs fully in-memory, no side effects

This demo is deliberately inert. It performs **no side effects**:

- no persistence or database access;
- no queues, events, HTTP, or filesystem writes;
- no external APIs, AI/LLM calls, or execution engines.

Everything happens in-memory against fixture data.

## Human approval required before execution

AGE follows **Human-Approved Execution**. The demo output is _what AGE
recommends_ — every accepted decision object is listed under
`PENDING HUMAN APPROVAL` and requires explicit human sign-off before anything
would ever be executed. The demo itself never executes anything.

## What each capability represents

- **Intelligence** — evaluates incoming evidence (quality, freshness,
  contradictions) and surfaces the evidence worth acting on.
- **Market Discovery** — turns raw market signals into scored opportunities
  (impact, confidence, priority) with execution domains attached.
- **Growth** — proposes growth plans (e.g. paid acquisition) against
  opportunities, scored by impact, effort, and confidence.
- **Authority** — proposes authority / thought-leadership plans against topics,
  scored by impact, effort, and confidence.
- **Operations** — proposes operational plans (e.g. project plans), scored by
  operational impact, effort, and confidence.
- **Revenue** — proposes revenue plans (e.g. upsell) against accounts, scored by
  revenue impact and value band, and may recommend a proposal draft.
