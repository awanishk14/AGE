# ADR 0004: Modular Monolith before Microservices

- Status: Accepted
- Date: 2026-06-27

## Context

AGE will scale from Founder Edition → Agency Edition → Commercial SaaS → Enterprise. Microservices
offer independent scaling but impose distributed-systems cost (network boundaries, eventual
consistency, deployment/operational overhead) that is premature for a young product.

## Decision

AGE is built as a **Modular Monolith** that is **microservice-ready**. Each bounded context is an
independent module under `apps/api/src/modules/<module>` with Clean-Architecture layers
(presentation → application → domain ← infrastructure), a pure domain, and explicit boundaries.
All modules compose via `DOMAIN_MODULES`.

Rationale:

- **Speed now** — one codebase, one deploy, in-process calls, simple transactions.
- **Boundaries already drawn** — DDD modules with no cross-module imports keep the seams clean.
- **Extraction later is mechanical** — promoting a module to a service means moving the folder and
  adding a transport, not rewriting domain logic.

## Consequences

- Module boundaries must be enforced (e.g. Nx `enforce-module-boundaries`) to prevent the monolith
  degrading into a big ball of mud.
- Cross-context collaboration goes through published ports/events, never internal entities.
- Service extraction is deferred until scaling or team structure genuinely demands it.
