# Demo module

Read-only bounded context that exposes the in-memory AGE capability demo over HTTP.

## Route

- `GET /demo/capabilities` — runs the six completed capabilities against local
  fixtures (via the shared `@age/demo-runtime` package) and returns their
  human-reviewable decision reports plus a summary.

## Boundaries

- **Read-only and side-effect-free.** No persistence, Prisma, Redis, queues,
  events, integrations, external APIs, AI/LLM, or execution engines.
- All logic lives in `@age/demo-runtime`; this module only adapts it to NestJS
  (controller + application service). No capability logic is duplicated here.
- Every accepted item is a recommendation **pending human approval** — the
  response never carries an execution result.
