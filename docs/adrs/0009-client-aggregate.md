# ADR 0009: Client Aggregate

- Status: Accepted
- Date: 2026-06-29

## Context

The Product Bible establishes `Client` as a first-class business concept (Doc 02 §5, Doc 05 §2).
A Client is the primary container where the platform's intelligence accumulates. It owns the BIF
instance, the BKG graph instance, all Research, Strategy, Assets, and Projects for a single
engagement.

The current domain architecture (20 bounded contexts, `DOMAIN_ARCHITECTURE.md`) does not include
a `client` module. No domain aggregate currently represents the Client boundary. The closest
existing entity is the `organization` module (the platform tenant — the agency, not the client's
business). The two are distinct concepts that must never be conflated (Doc 05 §2, §3).

The reserved identifier for this ADR was created in the Specification Validation Report (AR-02)
as a medium implementation risk that must be resolved before Phase 2 begins. Doc 02 §5 explicitly
anticipated this decision:

> "If implementation later proves the domain model cannot represent Client cleanly, a dedicated
> Client aggregate can be introduced via an implementation ADR at that time."

This ADR makes that decision.

### What the specification requires

From the frozen Product Bible:

- `Organization → Client → Project` is the canonical hierarchy (Doc 02 §3). It is a universal
  scope boundary for every permission, data boundary, execution context, and configuration
  scope in the platform.
- A Client owns its BIF, BKG instance, Research, Strategy, Assets, and Projects (Doc 02 §3, §5).
- A Client has a defined lifecycle: `Created → Onboarding → Active → Paused → Offboarding →
Archived` (Doc 02 §17, Doc 03).
- The BKG `Organization` node is the _implementation_ representation of the client's company
  (the Business) — not the agency tenant (Doc 05 §3). The Product Bible calls the client's
  company the **Business** to avoid this naming collision.
- Every execution runs within a single `Organization / Client / Project` scope (Doc 12 §7).
- Every capability reads and produces within a Client scope (Doc 02 §13).
- Client-derived knowledge never crosses Client boundaries (Doc 02 §15).
- Client members see only their own Client; agency members are granted access per Client
  (Doc 02 §12).

### Why the 20 existing modules do not satisfy this

The 20 bounded contexts model the 26 BKG node types. None of them owns the Client concept
because the BKG node for a client's company is called `Organization` (a legacy naming artefact,
now resolved by the canonical terminology in Doc 05 §3 as `Business`). No existing module holds:

- The `Organization → Client` ownership relationship.
- Client lifecycle state (`Created → Archived`).
- The consistency boundary that ties the BIF, BKG instance, and Projects to one Client.
- The Client-scoped permission and tenancy boundary.
- The Client repository port.

These responsibilities cannot be distributed across the existing modules without losing the
consistency boundary and creating cross-module ownership ambiguity.

## Decision

**Introduce a dedicated `client` domain module** as the 21st bounded context in
`apps/api/src/modules/client/`, following the identical four-layer structure used by all other
modules (`presentation/`, `application/`, `domain/`, `infrastructure/`, `tests/`).

The `client` module owns a **`Client` aggregate root** — the canonical implementation
representation of the Client business concept. `Client` is an `AggregateRoot` extending the
`@age/shared` domain kernel.

This is an **implementation decision only**. It introduces no new product concept, changes no
Product Bible document, and adds no capability or behavior. The canonical business hierarchy
`Organization → Client → Project` is unchanged; this decision gives it an implementation home.

## Aggregate boundaries

The `Client` aggregate root owns the following within its consistency boundary:

| Member                   | Type                        | Ownership                   |
| ------------------------ | --------------------------- | --------------------------- |
| `ClientId`               | ValueObject                 | Identity                    |
| `organizationId`         | `OrganizationId`            | Foreign key — parent tenant |
| `lifecycle`              | `ClientLifecycleState` enum | Owned (Created → Archived)  |
| `name`, `slug`           | ValueObjects                | Owned                       |
| `createdAt`, `updatedAt` | timestamps                  | Owned                       |

The following are **owned by Client but managed by their own modules** via the Client identity
as a foreign key. They sit outside the consistency boundary of the `Client` aggregate root itself
and are never loaded as part of the Client aggregate:

| Entity             | Module                          | Relationship                          |
| ------------------ | ------------------------------- | ------------------------------------- |
| `BIF` instance     | `@age/bif`                      | One per Client, scoped by `clientId`  |
| BKG graph instance | `@age/business-knowledge-graph` | One per Client, scoped by `clientId`  |
| Projects           | `project` module                | Many per Client, scoped by `clientId` |
| Research, Evidence | `research`, `evidence` modules  | Scoped by `clientId`                  |
| Assets             | `knowledge` module              | Scoped by `clientId`                  |
| Strategy           | SIE outputs                     | Scoped by `clientId`                  |

**The Client aggregate does not hold references to or embed these entities.** Ownership is
expressed by the canonical `clientId` foreign key on each dependent entity — not by aggregating
them into one root.

This boundary follows the DDD principle: a consistency boundary should be as small as possible.
The `Client` aggregate is responsible for Client identity, lifecycle, and the Organization
relationship. All intelligence accumulation is handled by the owning modules, each of which uses
`clientId` as its primary scoping key.

## Ownership responsibilities

The `client` module and its aggregate root own:

1. **Identity** — canonical `ClientId` typed identifier, re-exported from `@age/shared`.
2. **Lifecycle** — the six canonical states and their valid transitions:
   `Created → Onboarding → Active → Paused → Offboarding → Archived`. Transitions are enforced
   inside the aggregate and raise `DomainEvent`s.
3. **Organization relationship** — the `organizationId` link that places the Client within its
   tenant. All multi-tenancy enforcement for the Client boundary derives from this link.
4. **Agency-as-a-Client** — the agency itself may be a Client (Doc 02 §5). The `client` module
   handles this without a separate product mode; it is an ordinary `Client` record within the
   same Organization.
5. **Audit trail** — lifecycle transitions are audited via domain events. No hard deletes;
   archival preserves data (Doc 02 §17).

The `client` module does **not** own:

- BIF content, BKG nodes, Research, Evidence, Strategy, Assets, Projects — these are owned and
  managed by their respective modules with `clientId` as the scoping key.
- Permissions — the Permission Model (Doc 06) governs access; the `client` module only provides
  the `ClientId` boundary that permission checks are applied against.
- Execution — execution runs within a `clientId` scope enforced by the Execution Layer (Doc 12).

## Relationship with Organization and Project

```
Organization (organization module)
      │  1
      │  OWNS
      │  *
    Client (client module)       ← this ADR
      │  1
      │  OWNS
      │  *
   Project (project module)
```

- `Organization` is the tenant root. `Client` holds an `organizationId` foreign key; it never
  embeds or loads the `Organization` aggregate.
- `Project` holds a `clientId` foreign key. The `project` module is unchanged; it already
  expresses its Client relationship via this key.
- Neither `Organization` nor `Project` is modified by this ADR. The `client` module is additive.

## Lifecycle ownership

The `client` module owns the full Client lifecycle as defined in Doc 03:

```
Created → Onboarding → Active → Paused → Offboarding → Archived
```

Lifecycle transitions are:

- Enforced as guard logic within the `Client` aggregate — invalid transitions throw a
  `DomainError`.
- Published as `DomainEvent`s (e.g., `ClientActivated`, `ClientPaused`, `ClientArchived`) for
  downstream modules to react to.
- Never performed by external modules directly. External modules call use-cases in the `client`
  application layer; the aggregate enforces validity.

The lifecycle states are a closed set. No new states may be added without a Product Owner
decision and an updated ADR (Doc 03 §6.1).

## Persistence responsibilities

The `client` module's infrastructure layer owns the `clients` table schema and all read/write
operations against it. Specifically:

- The `ClientRepository` port is defined in `client/domain/`.
- The TypeORM (or equivalent) implementation lives in `client/infrastructure/`.
- The `clients` table holds only the Client aggregate's own properties: `id`, `organizationId`,
  `lifecycle`, `name`, `slug`, `createdAt`, `updatedAt`.
- Row-Level Security (RLS) for Client rows is enforced at the persistence layer against
  `organizationId`, consistent with the multi-tenancy model (Doc 02 §16).
- No foreign-key relationships from `clients` to BIF, BKG, Projects, or other dependent tables.
  Those tables hold `clientId` as their own scoping key.
- Soft delete only. Archived Clients are retained with full history; no row is hard-deleted.

## Repository ownership

A single `ClientRepository` port is defined in `client/domain/` and extends the `Repository<Client>`
base from `@age/shared`. The repository interface exposes:

```
findById(id: ClientId): Promise<Client | null>
findByOrganization(orgId: OrganizationId): Promise<Client[]>
save(client: Client): Promise<void>
```

No other module defines a `ClientRepository` or writes directly to the `clients` table. Modules
that need to verify Client existence or scope an operation to a Client use a read-only
`ClientId` reference — they do not load the full Client aggregate.

## Interaction with BIF and BKG

**BIF:**

- The BIF is owned by the Client (Doc 02 §8), but managed by `@age/bif`. The BIF is scoped to
  a `clientId`; the `@age/bif` package creates, updates, and reads the BIF using the `clientId`
  as its primary key.
- The `client` module does not call into `@age/bif`. The relationship is one of scoping, not
  dependency: the `client` module owns the `ClientId`; `@age/bif` uses that identifier.
- When a Client lifecycle event fires (e.g., `ClientArchived`), `@age/bif` may listen to the
  event and take appropriate action (e.g., freeze the BIF). This keeps the dependency
  direction correct: `@age/bif` knows about `ClientId`; the `client` module does not know about
  BIF internals.

**BKG:**

- The BKG instance for a Client's company is the set of graph nodes and relationships scoped to
  a `clientId` in `@age/business-knowledge-graph` (Doc 02 §9).
- The `Organization` BKG node represents the client's company (the Business) — not the agency
  tenant. This is a naming artefact; the canonical term is `Business` (Doc 05 §3).
- The `client` module does not call into `@age/business-knowledge-graph`. The BKG package
  scopes its graph instance by `clientId`. Provisioning the initial BKG instance for a new
  Client is triggered by a `ClientCreated` domain event, handled by `@age/business-knowledge-graph`
  or a dedicated application service.
- No circular dependency: `client` → `@age/shared` only. BIF and BKG packages depend on
  `ClientId` (a value object from `@age/shared`), not on the `client` module.

## Interaction with Capabilities

All six capabilities (`Market Discovery`, `Intelligence`, `Growth`, `Authority`, `Operations`,
`Revenue`) operate within a `clientId` scope:

- Every capability invocation receives a `clientId` as part of its input context. It reads BIF,
  BKG, SIE `DecisionPackage`, and other inputs scoped to that Client.
- Capability outputs (plan objects, opportunity objects) are tagged with `clientId`.
- Capabilities never load the `Client` aggregate. They use the `clientId` as a scoping key
  passed through the invocation context.
- The Capability Kit (`@age/capability-kit`) may define a `ClientContext` value object carrying
  `clientId` (and `organizationId` for RLS enforcement) — this is the only Client-related
  concept capabilities need. It does not depend on the `client` module.

## Interaction with the Execution Layer

Every execution action runs within a single `Organization / Client / Project` scope (Doc 12 §7).
The Execution Layer enforces this scope boundary:

- The `clientId` is a required parameter on every execution request. The Execution Layer rejects
  any request without a valid `clientId` that exists within the current `organizationId`.
- The Execution Layer validates Client existence and lifecycle (a `Paused` or `Archived` Client
  must not accept new execution) by querying the `ClientRepository` read port. This is a
  read-only existence check — the Execution Layer does not modify the Client aggregate.
- The `client` module does not depend on the Execution Layer. The dependency direction is
  Execution Layer → `client` (for the existence check), never the reverse.

## Consequences

**Structural:**

- The domain architecture gains a 21st bounded context: `client`.
  `DOMAIN_ARCHITECTURE.md` must be updated to add `client` to the bounded context list (a
  documentation update, not an architectural change).
- `MODULE_DEPENDENCIES.md` must be updated to record `client` dependencies
  (→ `@age/shared` only) and reverse dependencies (all modules that scope by `clientId`).

**Implementation:**

- Every module that stores or queries client-scoped data must hold a `clientId` column/field and
  use it as its primary data boundary. This is enforced in the persistence layer, not by
  loading the Client aggregate.
- Provisioning a new Client triggers domain events that initialize its BIF, BKG instance, and
  default project scope. The provisioning sequence is defined during Phase 2 implementation.
- The `client` module is the single gating dependency for Phase 2: no capability, integration,
  or execution component may proceed without a resolved `ClientId`.

**No change to the frozen specification:**

- The Product Bible (Docs 01–16) is unchanged.
- The Architecture documents are unchanged except for the two documentation updates above.
- The canonical hierarchy `Organization → Client → Project` is unchanged — this ADR gives it an
  implementation address.
- ADR-0001 through ADR-0008 are unchanged.

## References

- Doc 02 §3 — canonical hierarchy `Organization → Client → Project`
- Doc 02 §5 — Client as first-class business concept
- Doc 02 §7 — Project ownership
- Doc 02 §8 — BIF ownership
- Doc 02 §9 — BKG instance ownership
- Doc 02 §12 — user membership model
- Doc 02 §13 — AI agent ownership model
- Doc 02 §15 — cross-workspace boundary rules
- Doc 02 §16 — multi-tenant architecture
- Doc 02 §17 — workspace lifecycle
- Doc 03 — canonical Client lifecycle states
- Doc 05 §2 — Business Containers table
- Doc 05 §3 — canonical terminology: Business / Organization / Client disambiguation
- Doc 12 §7 — execution scope and isolation
- ADR-0002 — PostgreSQL persistence model
- ADR-0003 — BKG as canonical model
- ADR-0004 — modular monolith
- ADR-0006 — capability-based architecture
- ADR-0007 — capability vs execution domain
- ADR-0008 — capability registry
- `docs/architecture/DOMAIN_ARCHITECTURE.md` — 20 bounded contexts (becomes 21)
- `docs/architecture/CAPABILITY_ARCHITECTURE.md` §4 — capability contract
- `docs/reviews/SPECIFICATION_VALIDATION_REPORT.md` AR-02
