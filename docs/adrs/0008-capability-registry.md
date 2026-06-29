# ADR 0008: Introduce a Capability Registry

- Status: Accepted
- Date: 2026-06-28

## Context

If capabilities are referenced by hardcoded names and wiring throughout the platform, adding a new
capability (Sales, Customer Success, Finance, HR, …) becomes an architectural change touching many
files. AGE must scale to many capabilities without churn.

## Decision

Introduce a **CapabilityRegistry** as the canonical source of capability metadata. Each capability
declares a registry entry:

```
CapabilityRegistryEntry {
  name
  consumes
  produces
  outputs
  executionDomains[]
  dependencies[]
}
```

Capabilities must never be hardcoded across the platform; consumers resolve capability metadata via
the registry. New capabilities are **registerable without architectural changes**.

## Consequences

- The registry lives in `@age/capability-kit` and is the single place capabilities are declared.
- Orchestration, routing and tooling read capability metadata from the registry, not from constants.
- Adding a capability = registering an entry + its package, with no edits to existing capabilities.
