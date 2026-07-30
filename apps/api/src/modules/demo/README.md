# Demo module

Read-only bounded context that exposes the in-memory AGE capability demo over HTTP.

## Route

- `GET /demo/capabilities` — runs the upstream Business Discovery intake and the
  six completed capabilities against local fixtures (via the shared
  `@age/demo-runtime` package) and returns their human-reviewable decision
  reports plus a summary.

## `businessDiscovery`

The response carries a `businessDiscovery` block: the intake stage, reported as
**context**. It is not a capability — it produces no decision objects, carries no
`pendingApproval`, and never changes the six-capability accounting.

Its four scores are two separate measurements and must never be presented as
interchangeable:

- `discoveryCompletenessScore` / `discoveryConfidenceScore` — properties of the
  _interview_.
- `bifCompletenessScore` / `bifConfidenceScore` — properties of the produced
  Draft BIF.

`bifStatus` is always `Draft`: this endpoint never promotes a BIF. Sections the
intake could not populate are listed in `omittedSectionTypes` as limitations —
they are never filled in and never treated as evidence about the business.

## Boundaries

- **Read-only and side-effect-free.** No persistence, Prisma, Redis, queues,
  events, integrations, external APIs, AI/LLM, or execution engines.
- All logic lives in `@age/demo-runtime`; this module only adapts it to NestJS
  (controller + application service). No capability logic is duplicated here.
- Every accepted item is a recommendation **pending human approval** — the
  response never carries an execution result.
