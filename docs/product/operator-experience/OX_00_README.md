# The Operator Experience Program

> A program, not a document. Seven phases, produced together so that no phase can quietly
> contradict another. **Status: Proposed in full — none of it is authorized to be built.**
> The governing decision request is **ADR-0057**.

## Why this exists

Everything AGE knows is currently behind code. A real business's discovery answers go in as a JSON
file typed by hand, and the scored result comes out as a Postgres row nobody has ever read back.
The only thing a human can see in a browser is `apps/web/src/app/demo/page.tsx` — 435 lines rendering
a **frozen, fictional** scenario (`DEMO_SCENARIO_METADATA`, `constructedAt` pinned to 2026-01-01).

That is not a UI gap. It is an **evidence gap**: AGE makes claims about a business, and there is no
surface on which the operator can ask _why does it think that, what supports it, and what is
missing._ The Operator Experience exists to close that, and closing it is the whole point — not the
screens.

## The documents

| #   | Phase                             | Document                                                               |
| --- | --------------------------------- | ---------------------------------------------------------------------- |
| 1   | Operator Experience Product Bible | [`OX_01_PRODUCT_BIBLE.md`](./OX_01_PRODUCT_BIBLE.md)                   |
| 2   | UX Architecture                   | [`OX_02_UX_ARCHITECTURE.md`](./OX_02_UX_ARCHITECTURE.md)               |
| 3   | Information Flow                  | [`OX_03_INFORMATION_FLOW.md`](./OX_03_INFORMATION_FLOW.md)             |
| 4   | Existing Capability Mapping       | [`OX_04_CAPABILITY_MAP.md`](./OX_04_CAPABILITY_MAP.md)                 |
| 5   | Gap Analysis                      | [`OX_05_GAP_ANALYSIS.md`](./OX_05_GAP_ANALYSIS.md)                     |
| 6   | ADR Planning                      | [`OX_06_ADR_PLAN.md`](./OX_06_ADR_PLAN.md)                             |
| 7   | Implementation Roadmap            | [`OX_07_IMPLEMENTATION_ROADMAP.md`](./OX_07_IMPLEMENTATION_ROADMAP.md) |

Read them in order. Phase 4 is the one that constrains all the others: it is the audit that says
whether a screen is describing something that exists.

---

## ⚠️ The reconciliation you must read before anything else

`docs/product/07_UI_NAVIGATION.md` is **Final and approved by the Product Owner**. It defines a
**permission-aware, multi-user** product navigating `Organization → Client → Project`, where "users
only _discover_ the contexts they have access to."

The Operator Experience brief states the opposite constraints: **single operator, local machine,
trusted operator, no authentication, no multi-user workflows, same trust model as today's CLI.**

**These are not in conflict, and this program does not amend Doc 07.** They describe two different
surfaces:

|              | Doc 07 — the product             | The Operator Console — this program              |
| ------------ | -------------------------------- | ------------------------------------------------ |
| Audience     | Many users across an agency      | One operator, on their own machine               |
| Trust model  | Authenticated, permission-scoped | Ambient — same as the CLI shell                  |
| Reachability | A deployed service               | **Loopback only, by construction**               |
| Purpose      | Operating an agency              | Seeing what AGE thinks, and why                  |
| Status       | The destination                  | A precursor that must not become the destination |

**The Operator Console is not a first draft of Doc 07's product and must never be promoted into
one.** The moment a second person can act, or the surface is reachable off the machine, Doc 07's
model — and authentication — becomes mandatory. That is not this program's opinion; it is
ADR-0053 dissent 1 and ADR-0055 D9, both already on the record.

### The invariant that makes "no authentication yet" safe

Deferring authentication is only defensible if the surface is **structurally incapable** of being
reached by a second party. A promise is not a control; the repository already learned this when it
found its own visibility had flipped to private and back without anyone noticing (_"private is not a
control"_).

> **OX-INV-1 — The console binds to loopback and refuses to start otherwise.**
> The HTTP listener binds `127.0.0.1` explicitly. A configured host that is not loopback is a
> **startup refusal**, not a warning. There is no flag to relax it, and no `allowRemote` option —
> for the same reason `openLocalPrismaCaptureConnection` is a separate function rather than a
> boolean on the general one.

⚠️ **And the same honesty that governs `assertLocalDatabaseTarget` applies here: loopback is
NECESSARY, NOT SUFFICIENT.** A reverse proxy or an SSH tunnel in front of a loopback listener
defeats it entirely. OX-INV-1 refuses the cases it can see, which is strictly better than refusing
none, and 🚫 it must never be described as proving the console is unreachable.

---

## Standing principles for the whole program

1. **The UI is an expression of the architecture and never redefines it.** Every screen element in
   Phases 1–3 carries a mapping in Phase 4 or is listed as a gap in Phase 5. Nothing is invented.
2. **Absence is rendered as absence.** An omitted BIF section is shown as omitted, never as empty,
   never filled with a placeholder, never styled as a zero. `sufficiency` left `undefined` is
   rendered "not assessed" and never "ready". This is ADR-0026 D4 made visible, and it is the single
   most load-bearing rendering rule in the program.
3. **A low score is a correct result.** No screen offers an affordance that improves a score. There
   is no "boost", no "recalculate", no cap to raise. The console cannot make AGE more confident.
4. **The console is READ-ONLY and performs no write at all.** _(Product Owner, 2026-08-03 — ADR-0057
   D4 as amended.)_ It is a window, and nothing else: ✅ View · Browse · Inspect · Understand ·
   🚫 never Modify, Execute, Approve or Delete. Reads travel over a connection **structurally
   incapable of writing**. 🛑 A future write surface requires a **NEW ADR**, and 🚫 may not be reached
   by increments.
5. **Peer products are shown, never absorbed** (ADR-0053). AGE displays what a peer product's public
   contract returns and reasons over it. It renders no peer product's UI and reimplements no peer
   product's screens.
6. **Provenance travels with every claim.** A number without its evidence is not shippable in this
   program. If a value cannot state where it came from, the screen shows the value as unattributed
   rather than presenting it as known.

## What would stop this program

Per the brief, work stops and returns to the owner when a product decision needs approval, an
architectural invariant would change, accepted ADRs conflict, or new functionality needs governance.
**Every item in Phase 5 and Phase 6 is such a stop.** The documents are produced; the code is not.
