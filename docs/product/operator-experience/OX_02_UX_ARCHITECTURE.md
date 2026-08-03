# Phase 2 — UX Architecture

> Application structure, not visual design. No layouts, no components, no styling.
> **Status: Proposed.** Governed by ADR-0057.

---

## 1. The shape of the application

```
/                                  Console Home (S1)
/diagnostics                       Diagnostics (S13)
/businesses                        Businesses (S2)
/businesses/:clientId              Business Overview (S3)
  /discovery                       Discovery (S4)
  /bif                             Business Information Framework (S5)
  /bif/:sectionKey                 One BIF section
  /evidence                        Evidence (S6)
  /contradictions                  Contradictions (S7)
  /intelligence                    Intelligence (S8)
  /strategy                        Strategy (S9)
  /execution                       Execution (S10)
  /history                         History (S11)
  /history/:snapshotId             One snapshot
  /peers                           Peer Products (S12)
```

Two levels of navigation and no more. Above `:clientId` the operator is choosing _which business_;
below it they are choosing _which lens_. There is no third level because there is no third level in
the architecture.

⚠️ **`:clientId` in a path is not authorization and must never be mistaken for it.** In the console
it is scope selection under an ambient trust model — the same status it has as a CLI flag. The moment
this surface is reachable by anyone else, that path segment becomes the exact vulnerability ADR-0055
D9 describes: _scope asserted by the caller, checked only for self-consistency._ This is why
**OX-INV-1** is structural and why Phase 6 makes the entitlement function a hard precondition for any
non-loopback deployment.

---

## 2. Why each navigation area exists

The brief names twelve candidate areas. Four of them do not survive Phase 4's audit, and saying so is
more useful than accommodating them.

### Kept

| Area                               | Why it exists                                                               | Backed by                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Businesses**                     | The operator runs several; scope selection has to happen somewhere explicit | `@age/client-registry`                                       |
| **Dashboard** (Console Home)       | Orientation: what changed, what waits, what broke                           | Composed from below                                          |
| **Discovery**                      | The intake is the only place a human puts facts _in_                        | `@age/discovery-answer-file`, `business-discovery-contracts` |
| **Business Information Framework** | The thing AGE believes; the centre of the product                           | `@age/bif`, 13 sections                                      |
| **Evidence**                       | Belief without support is the failure mode this program exists to prevent   | `@age/evidence-contracts`                                    |
| **Strategy**                       | What AGE proposes                                                           | `@age/strategy-intelligence-engine` (⚠️ unwired — Phase 5)   |
| **Execution**                      | Approval is the boundary between thinking and acting                        | Demo approvals only (⚠️ Phase 5)                             |
| **Peer Products**                  | ADR-0053's whole point: display and reason, never absorb                    | Contract surface (⚠️ Phase 5)                                |
| **History**                        | Snapshots are append-only; history is the data model, not a feature         | `@age/scored-bif-snapshot-persistence`                       |

### Rejected, with reasons

| Area               | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organizations**  | 🚫 **Not a navigation area.** `organizationId` exists only as a scope component read off a `ClientRecord`. It has no aggregate, no screen's worth of content, and 🚫 no place where it may be _typed_ — `--organization-id` is refused by name for exactly this reason. Surfacing it as a level would invite the fabricated scope ADR-0046 D7 was written about. It is shown as an attribute on S2/S3 and nowhere else. |
| **Knowledge**      | ⚠️ **Deferred, not rejected.** `@age/business-knowledge-graph` exists (nodes, edges, ontology, queries) but has no producer wired to a real business. A Knowledge area today would render an empty graph and imply AGE knows more than it does. Listed as gap **G-11**.                                                                                                                                                 |
| **Administration** | 🚫 **Refused.** Administration administers users, roles and tenants. There are none. An admin area is the first place multi-user assumptions leak in.                                                                                                                                                                                                                                                                   |
| **Settings**       | 🚫 **Folded into Diagnostics.** The console has no meaningful preferences. What it does have is claims about itself that must be auditable — and that is Diagnostics, which _shows_ configuration rather than accepting it. Configuration arrives from the environment and files, as it does for the CLI.                                                                                                               |

**Two areas were added** because the architecture demanded them and the brief's list did not have
them:

| Area               | Why                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contradictions** | `EvidenceState.CONFLICTED` and `detect-contradictions.ts` already exist. AGE disagreeing with itself is its most valuable output and would otherwise be buried inside Evidence. |
| **Diagnostics**    | See §1 of the Bible: a console that cannot be audited is a second opinion, not a window.                                                                                        |

---

## 3. Navigation model

**Context is persistent** (Doc 07 §4, and it applies unchanged here). Once the operator enters a
business, every subject-level navigation stays within it. Switching business is deliberate and
explicit, never a side effect.

**Scope is displayed at all times.** The current `clientId` / `organizationId` pair is visible on
every subject screen. Not because the operator might forget, but because a screen showing a business's
facts without naming the scope those facts were read under is the same class of error as a refusal
message that names the wrong client.

⚠️ **The `displayName` is shown in the console but is never written to a log, an error message, or a
committed file.** The CLI deliberately does not echo it during onboarding; the console showing it
on-screen is fine, and the console _logging_ it is not.

**No search-first navigation.** With a single operator and a handful of businesses, search is a gap
(G-8), not a foundation. Navigation is by structure.

---

## 4. Rendering rules that are architecture, not styling

These are not aesthetic choices. Each corresponds to an invariant that a normal UI would break.

| Rule                                                                                                          | The invariant it protects                                      |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| An omitted BIF section renders as **omitted**, in its own visual class, never as empty state and never as `0` | ADR-0026 D4 — absence is a limitation, never negative evidence |
| The four scores never share an axis, a widget or an average                                                   | `discoveryCompletenessScore` ≠ `bif.completenessScore`         |
| `sufficiency === undefined` renders "not assessed"                                                            | 🚫 never defaulted to `ready`                                  |
| A capability that ran and produced nothing renders differently from one that did not run                      | `output.items` emptiness ≠ absence of a run                    |
| A snapshot has no edit or delete affordance anywhere                                                          | `GRANT SELECT, INSERT`                                         |
| Peer data is always attributed to its peer by name                                                            | ADR-0053 — display, never absorb                               |
| A value with no provenance renders **as unattributed**                                                        | Never fabricate provenance                                     |
| Refusals render the refusal text, not a generic error                                                         | The refusals are governed wording                              |

⚠️ **The last one matters more than it looks.** The CLI's refusals were written with care to name a
position and never file contents; three separate leaks were found and fixed where a parser message
was spliced in. **A console that catches an error and renders `error.message` re-opens every one of
those leaks in a browser.** The console renders the _refusal_ the domain produced, and never a
driver's message and never a stack.

---

## 5. State model

| State             | Belongs to                  | Persistence                  |
| ----------------- | --------------------------- | ---------------------------- |
| Selected business | URL                         | The URL is the state         |
| Selected snapshot | URL                         | The URL is the state         |
| Answer file draft | The operator's file on disk | Their file, outside the repo |
| Everything else   | Derived on request          | None                         |

**The console holds no session, no cache of business data, and no client-side store of record.** It
has no session because it has no user. It caches nothing because a stale BIF rendered as current is
the console lying — and this program's entire value is that it does not.

---

## 6. Delivery shape

Reuses what exists rather than introducing a stack:

- `apps/web` — Next.js, already present, currently two pages.
- `apps/api` — NestJS, already present, currently two routed endpoints. Every other controller is a
  scaffold with no HTTP decorator at all.

⚠️ **The demo track is read-only and must stay byte-identical** — `/demo` and `GET /demo/capabilities`
keep their frozen fictional scenario, `constructedAt` pinned. The console is **additive**. Nothing in
this program edits the demo surface, and the 98/63 vs 12/17 baseline does not move.

⚠️ `apps/web` unit tests are not functional (vitest wants `jsdom`, which is not installed). Any
testable logic must live below the rendering layer, in a package, where it can be tested — which is
exactly the split ADR-0048 already made for the readiness surface. 🚫 Do not push logic into a
component because the component is where the data is.
