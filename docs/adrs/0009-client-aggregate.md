# ADR 0009: Client Aggregate

- Status: Reserved — pending implementation phase
- Date: 2026-06-29

## Context

The Product Bible establishes `Client` as a first-class business concept (Doc 02 §5, Doc 05 §2).
`Client` owns the BIF, BKG instance, research, strategy, assets, and projects for each engagement.
The current domain architecture (20 bounded contexts) does not include a `client` module; the
Business Knowledge Graph uses an `Organization` node as the implementation-level representation of
the client's company (Doc 05 §3 note). Doc 02 §5 explicitly acknowledges this gap and states: _"if
implementation later proves the domain model cannot represent Client cleanly, a dedicated Client
aggregate can be introduced via an implementation ADR."_

The Specification Validation Report (AR-02) identified this as a medium implementation risk that
must be resolved before or during Phase 2.

## Decision

_Not yet made. This ADR identifier is reserved._

This ADR will define how the `Client` concept is represented in the implementation architecture —
whether as a dedicated bounded context (`client` module), as an aggregate within an existing
context, or as a cross-cutting concern — without changing the frozen Product Bible model.

## Consequences

_To be recorded when the decision is made._

## References

- Doc 02 §5 — Client as a first-class business concept
- Doc 05 §2 — Business containers table
- Doc 05 §3 — BKG `Organization` node as implementation representation of client's company
- Specification Validation Report AR-02
