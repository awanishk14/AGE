# ADR 0028: Registry Metadata for Context Consumption

- Status: Proposed
- Date: 2026-07-25

## Context

ADR-0027 (Accepted) permits a capability to read a caller-assembled `ScoredBifContext` **solely** to
report whether that context is sufficient for its own work, through a separate, explicitly named entry
point that never gates `run` and derives no plan. Its **Decision 3** deferred one question to a future
ADR:

> Whether `CapabilityRegistryEntry.consumes` should advertise `ScoredBifContext` for capabilities that
> assess it.

Three capabilities have now adopted the readiness pattern, each in its own slice and proof:

| Capability       | Readiness entry point        | `consumes` today           | Merged in |
| ---------------- | ---------------------------- | -------------------------- | --------- |
| Intelligence     | `assessBusinessContext(...)` | `['RIEEvidencePackage']`   | PR #86    |
| Market Discovery | `assessMarketContext(...)`   | `['MarketDiscoveryInput']` | PR #90    |
| Revenue          | `assessRevenueContext(...)`  | `['RevenueInput']`         | PR #92    |

This is the evidence ADR-0027 said the decision needed. The question can now be answered against three
real adopters rather than speculation, so this ADR proposes a resolution.

### What `consumes` means today

Per ADR-0008, `CapabilityRegistryEntry` is the canonical, non-hardcoded declaration of capability
metadata that "orchestration, routing and tooling read … not from constants." The `consumes` field is
a flat `ReadonlyArray<string>` of input-contract names. Across all six capabilities it names exactly
one thing: the input contract that capability's **`run` method requires** (`RevenueInput`,
`MarketDiscoveryInput`, …). Its established meaning is therefore **"the inputs `run` requires"** — a
statement about a mandatory precondition of execution.

`ScoredBifContext` does not fit that meaning. It is:

- **not required by `run`** — `run` never receives it and is structurally forbidden from consulting it
  (ADR-0027 Decision 1);
- read **only** by a separate, non-gating readiness entry point;
- **optional** — a capability functions fully without ever being handed one.

So the field and the value do not match: `consumes` asserts a required input; `ScoredBifContext` is an
optionally-assessed one. The registry contract has no vocabulary for "optionally assessed," which is
exactly the interface gap ADR-0027 Decision 3 flagged.

### Corrected premise (a factual amendment to ADR-0027 Decision 3)

ADR-0027 Decision 3 stated that `consumes` "feeds the read-only demo registry, and … changing it
changes demo output." That premise is **not accurate as the code stands** and should not be relied on:

- The six `*_CAPABILITY_ENTRY` constants are imported only by their own package barrels and their own
  unit tests. No code under `apps/` (`api`, `demo`, `web`) reads `.consumes`, resolves an entry, or
  renders registry metadata into demo output.
- `CapabilityRegistry.register/resolve/list` exists in `@age/capability-kit` but has no runtime caller
  outside `capability-kit`'s own tests.

The registry metadata is therefore **latent/advisory today**: changing `consumes` changes _test
expectations_, not demo output. This lowers the blast radius of any change — it is a contract-and-test
change, not a behavioural one — but it does **not** resolve the semantic question, which stands on its
own regardless of who reads the field. The ADR is decided on the semantics, and the corrected premise
only re-scopes the consequences.

## Options considered

### Option A — Leave `consumes` unchanged; advertise nothing

The registry keeps meaning "required inputs only." Readiness support stays discoverable solely through
the capability's typed entry-point method (`assessRevenueContext`, …).

- **For:** zero contract change; `consumes` keeps a single, clean meaning; no risk of a consumer
  inferring a false precondition.
- **Against:** the registry — the platform's canonical "what can this capability do" surface —
  understates three capabilities. Any future orchestrator or tool that wants to discover "which
  capabilities can assess context readiness" cannot, and would have to hardcode the list, which is the
  precise anti-pattern ADR-0008 exists to prevent.

### Option B — Add `ScoredBifContext` to the existing flat `consumes` array

`consumes: ['RevenueInput', 'ScoredBifContext']`.

- **For:** trivial; one string per adopting entry.
- **Against:** **semantically wrong.** It asserts `run` requires `ScoredBifContext`, which is false and
  is exactly what ADR-0027 Decision 1 forbids anyone from concluding. It collapses the
  required-vs-optional distinction that is the whole substance of the question, and would mislead every
  consumer ADR-0008 built the registry to serve. Rejected.

### Option C — Extend the contract with a separate optional field (recommended)

Keep `consumes` = required inputs, and add a new, additive, optional field that advertises optionally
assessed context — e.g.:

```
interface CapabilityRegistryEntry {
  readonly name: Capability;
  readonly consumes: ReadonlyArray<string>;          // unchanged meaning: inputs `run` requires
  readonly assessesContext?: ReadonlyArray<string>;  // NEW: contracts read only by a non-gating
                                                     // readiness assessment (ADR-0027), never by `run`
  readonly produces: ReadonlyArray<string>;
  readonly executionDomains: ReadonlyArray<ExecutionDomain>;
  readonly dependencies: ReadonlyArray<Capability>;
}
```

Adopting entries set `assessesContext: ['ScoredBifContext']`; the three non-adopters leave it
`undefined`. `consumes` on every entry is untouched.

- **For:** models the domain honestly — required and optional inputs are distinct facts and get
  distinct fields; additive and backward-compatible (`undefined` = "assesses no context", the correct
  default for a non-adopter, mirroring how `sufficiency` is left `undefined` in ADR-0026); the registry
  now tells the truth about all three adopters without asserting a false precondition; the field name
  encodes the ADR-0027 guarantee ("assesses", never "requires").
- **Against:** it is a change to a shared `@age/capability-kit` contract, touching the interface and
  every entry's unit-test expectations (six specs, three of which would assert the new field). A contract
  change to the shared kit is precisely the kind of decision that must be ratified before code, which is
  why this ADR exists rather than a direct implementation.

### Option D — Defer again

- **Against:** the only reason to defer was insufficient evidence, and ADR-0027 named the exact
  threshold — a third consumer. That threshold is met. Deferring now would be indecision, not caution.

## Recommended decision (for ratification)

Adopt **Option C**, in three parts:

1. **`consumes` semantics are fixed and documented as "the input contracts a capability's `run`
   requires."** This is a clarification of existing meaning, not a change; no entry's `consumes` value
   changes.
2. **Add an optional `assessesContext?: ReadonlyArray<string>` field to `CapabilityRegistryEntry`**,
   defined as "contracts the capability reads **only** through a non-gating readiness assessment
   (ADR-0027), never through `run`." Absence (`undefined`) means the capability assesses no external
   context — the correct default and the state of every non-adopter.
3. **Adopting entries advertise `assessesContext: ['ScoredBifContext']`;** all others leave it unset.
   Populating it is part of each capability's own slice, not a blanket rollout — consistent with
   ADR-0027's "pattern, not licence to roll out."

Ratification is required because part 2 changes a shared contract in `@age/capability-kit`. Per the
project's decision rule, this ADR proposes the change and does not implement it.

## Consequences

**Easier.** The registry stops understating what capabilities can do, without ever asserting a false
precondition. "Which capabilities assess context readiness?" becomes a metadata query, not hardcoded
knowledge — the ADR-0008 goal, extended to a new axis. Required and optional inputs are finally
distinguishable in the contract that other tooling reads.

**Harder.** `CapabilityRegistryEntry` gains a field, so every entry spec is touched even though only
three populate it, and any future registry consumer must decide whether it cares about `assessesContext`.
A new optional field is a small but permanent surface-area increase on the shared kit.

**Deliberately not decided here.**

- The exact field name and shape (`assessesContext` vs `optionallyConsumes` vs a structured
  `{ contract, required }[]`) — the recommended name is a proposal; ratification may pick another. The
  **principle** — required and optional inputs are distinct and must not be flattened into one array —
  is what this ADR asks to settle.
- Whether the registry should ever be wired into demo/API/orchestration output at runtime. It is latent
  today (see corrected premise); making it live is a separate slice with its own ADR if it changes
  observable behaviour.
- Whether every capability should eventually adopt the readiness pattern — unchanged from ADR-0027,
  still per-slice.

**Unchanged.** Every ADR-0026 and ADR-0027 guarantee holds: `run` never consults context; readiness is
never a gate; no capability imports `@age/bif`; `consumes` continues to mean required inputs and is not
repurposed; missing context is a limitation, never negative evidence. This ADR adds a way to _describe_
context assessment in metadata; it grants no new runtime behaviour and no new consumption path.
