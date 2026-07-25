# ADR 0034: ClientContext-Bound Scored BIF Snapshot Access

- Status: Accepted
- Date: 2026-07-26

## Acceptance note — 2026-07-26

ADR-0034 is accepted as the governing decision for `ClientContext`-bound scored BIF snapshot access. It
ratifies `ClientContext` as the only authoritative source for `clientId` and `organizationId` at
snapshot call sites, forbids callers from providing scope directly, requires application-facing helpers
to derive scope from `ClientContext`, permits lower-level composite-key repositories internally, and
requires RLS settings to be sourced from `ClientContext`-derived scope only. It does not authorize
API/Web exposure, workspace implementation, `Draft → Active` promotion, or broader persistence
refactoring.

The "Implementation constraints" and "First implementation slice after acceptance" sections are binding
on the slice that follows. The factual correction recorded in the Context — that `scoringVersion` is
not a caller input, because it already travels inside `ScoredBifContext.metadata` — is accepted with
the rest.

## Context

ADR-0033 (PR #114) put row-level security on `scored_bif_snapshots`. The policy is correct and proven
against live PostgreSQL as a non-owner, non-superuser, `NOBYPASSRLS` role: no transaction can read or
write a row outside the scope it declared, and a missing setting fails closed.

**The finding that produced this ADR.** The first live run of PR #114 failed on a test asserting that
`ScopedScoredBifSnapshotRepository.findBySnapshotId`, handed a foreign row's own key, returns null. It
does not, and it should not. The scoped repository derives its transaction-local RLS settings **from
the key it is handed**:

```ts
// ScopedScoredBifSnapshotRepository.inScope — the shape of the problem
return this.runner.runInScope(
  { clientId: scope.clientId, organizationId: scope.organizationId }, // ← from the key
  (snapshots) => operation(new PrismaScoredBifSnapshotRepository(snapshots)),
);
```

Scope and key therefore cannot disagree by construction. A caller that hands the repository
`{clientId: 'client-b', …}` opens a client-b-scoped transaction, and the policy correctly admits
client-b's rows. That is not a hole in the policy — the database is enforcing exactly what it was
asked to enforce. It means something narrower and more important:

> **The adapter is not the trust boundary against a caller that fabricates a scoped key.** The
> database checks that the transaction's declared scope and the row agree. Nothing yet checks that the
> declared scope is the caller's _own_.

What is supposed to hold that line is ADR-0009: `ClientContext` carries the `clientId` and
`organizationId` a capability invocation is scoped to, and ADR-0030/ADR-0031 make it authoritative —
scope is never inferred from a BIF payload. But today that is a rule written in prose and in doc
comments. Every application-facing entry point into snapshot persistence takes a key with `clientId`
and `organizationId` as plain strings, so honouring `ClientContext` is a convention a caller can
forget silently, and forgetting it is indistinguishable from lying about it.

### Verified repository state

- `packages/capability-kit/src/context/client-context.ts` — `ClientContext` is a two-field class
  (`clientId`, `organizationId`), exported from the package barrel. It is documented as the only
  Client-related concept a capability needs, authoritative for RLS and data scoping (ADR-0009).
- `@age/capability-kit` has **zero runtime dependencies**. `@age/scored-bif-snapshot-persistence`
  depends only on `@age/business-discovery-contracts`. A dependency from the persistence package on
  the kit therefore introduces **no cycle**.
- `ScoredBifSnapshotScope` / `…SeriesKey` / `…Key` / `…Record` in
  `packages/business-discovery-contracts/src/scored-bif-snapshot-repository.ts` all carry `clientId`
  and `organizationId` structurally. The port takes the two ids as data, not a `ClientContext` — a
  deliberate stage-2 call, because importing the kit into a _contracts_ package would invert the
  dependency direction.
- **There is still no runtime caller.** Nothing under `apps/` constructs a snapshot record. This ADR
  is about closing the boundary _before_ the first caller exists, not about repairing one.

### A factual correction to the framing of this decision

The task framing lists `scoringVersion` among the fields a caller supplies. It is not one.
`scoringVersion` lives inside `ScoredBifContext.metadata` and is projected into the `scoring_version`
column by `toScoredBifSnapshotRow` (`context.metadata.scoringVersion ?? null`). It is never read back
into a record, and a caller has no way to pass it separately. Accepting a `scoringVersion` parameter
would create a second, contradictable source for a value the context already carries. The
application-facing input is therefore: `bifId`, `snapshotId`, `capturedAt`, and the context payload —
`scoringVersion` travels inside the payload, as it already does.

## Decision

### D1 — `ClientContext` is the only authoritative source of scope

At every application-facing scored BIF snapshot call site, `clientId` and `organizationId` come from
the caller's `ClientContext` and from nowhere else. Not from a BIF payload, not from
`ScoredBifContext`, not from a request body, not from the snapshot's `context` JSON, not from a
sibling parameter.

### D2 — Callers do not supply scope

Application-facing helpers accept `bifId`, `snapshotId`, `capturedAt` and the context payload. They
**do not accept** `clientId` or `organizationId`. This is enforced by the type signature, not by a
convention or a runtime check: there is no parameter to pass them through.

### D3 — A `ClientContext`-bound facade, not a port redesign

Add a small facade that takes a `ClientContext` plus the non-scope inputs, assembles the composite key
and record internally, and delegates to the existing `ScoredBifSnapshotRepository`. The port keeps its
current shape.

The alternative — changing the port to take a `ClientContext` — is rejected for now. The port lives in
`@age/business-discovery-contracts`, whose purity guard forbids exactly this kind of dependency, and
the structural two-id shape is what lets the in-memory adapter, the Prisma adapter and the table
doubles all satisfy it. Narrowing the port is a larger decision with its own blast radius; it is not
needed to close this boundary.

### D4 — The lower-level composite-key repository stays valid

`ScoredBifSnapshotRepository`, `PrismaScoredBifSnapshotRepository`, `InMemoryScoredBifSnapshotRepository`
and `ScopedScoredBifSnapshotRepository` are unchanged and remain the supported internal interface.
Composite keys are how rows are addressed; the facade governs how those keys are _constructed_. Both
layers remain, with different jobs.

### D5 — The facade lives in `@age/scored-bif-snapshot-persistence`

It is an adapter-layer concern, it needs both the port and `ClientContext`, and the dependency
direction is clean: the persistence package gains `@age/capability-kit` (which depends on nothing).
The contracts package is not touched, so its purity guard stays exactly as it is.

### D6 — RLS settings stay `ClientContext`-derived, transitively

The facade builds the key from `ClientContext`; `ScopedScoredBifSnapshotRepository` derives the
transaction-local settings from that key; the policy then re-checks both ids against the row. A key
that could only have come from a `ClientContext` therefore produces settings that could only have come
from a `ClientContext`. **ADR-0033 is not modified.** No policy, grant, role or migration changes.

### D7 — Wrong-scope tests are expressed as different `ClientContext` values

A wrong-client or wrong-organization test constructs a _second `ClientContext`_ and shows that access
through it fails. Tests must not simulate a breach by mutating a payload or hand-building a foreign
key, because through the facade neither is expressible — and a test that reaches around the facade
proves something about the port, not about the boundary this ADR adds.

### D8 — Scope is never read from the payload

The facade must not consult `ScoredBifContext`, `context.metadata`, or any field of the snapshot to
determine scope, even where a plausible-looking id exists there. `ScoredBifContext` carries `bifId`
(the subject, legitimately a caller input) and no client or organization id to consult, and it must
not grow one.

### D9 — Scope of this decision

This applies to scored BIF snapshot persistence only. It is not a general tenancy refactor, and it
does not oblige any other package to adopt a facade. Whether the pattern generalises is a later
question that needs a second adopter as evidence — the same standard applied to the readiness pattern
in ADR-0027.

### D10 — Not authorized

No API exposure. No Web exposure. No demo-runtime change. No workspace implementation. No
`Draft → Active` promotion. No erasure/retention design. No schema, migration or RLS change. No
`@age/persistence` generalisation. No second database technology.

## The ten questions, answered

1. **Who owns `clientId` and `organizationId` at call sites?** `ClientContext`, exclusively (D1).
2. **What may callers provide directly?** `bifId`, `snapshotId`, `capturedAt`, the context payload —
   and `scoringVersion` only inside that payload, where it already lives (D2, and the correction above).
3. **What must be derived from `ClientContext`?** `clientId` and `organizationId`, always (D1, D2).
4. **Is the lower-level composite-key repository still valid?** Yes, unchanged (D4).
5. **Should there be a `ClientContext`-bound facade?** Yes (D3).
6. **Where?** `@age/scored-bif-snapshot-persistence`, which gains a dependency on
   `@age/capability-kit` (D5).
7. **How does it interact with RLS?** Transitively and without changing it: facade → key → scoped
   transaction settings → policy (D6).
8. **How are wrong-scope tests expressed?** As a different `ClientContext`, never as payload
   mutation (D7).
9. **What is out of scope?** D9 and D10.
10. **What is the first slice?** The section below.

## Consequences

- **The honest limit is closed at the type level.** A caller holding a `ClientContext` for client-a
  cannot express a client-b operation through the facade. The failure mode changes from "silent
  cross-tenant access" to "does not compile".
- **A second way to reach the same table now exists.** The port is still there and still takes raw
  ids. That is deliberate — adapters, tests and doubles need it — but it means "use the facade" is a
  rule for _application_ code, and the first real caller is where that rule gets its teeth. Recorded
  as a residual, not waved away.
- **`ClientContext` gains a consumer outside the capability packages**, so its shape is now load-bearing
  for persistence too. It is a two-field immutable class with no behaviour; that is a small surface to
  depend on, but it is no longer free to change.
- **The facade is a new place where `capturedAt` and `snapshotId` arrive from a caller.** ADR-0030 made
  both caller-supplied on purpose (no clock, no id generation in the port). The facade inherits that
  and must not start minting either.

## Implementation constraints (binding on the slice that follows)

1. No change to `packages/business-discovery-contracts` — its purity guard stays as is.
2. No change to any migration, policy, grant, role or workflow authorized by ADR-0032/ADR-0033.
3. No clock, no randomness, no id generation in the facade.
4. Every existing test stays green, including the 23 live RLS tests and the 26-test live suite.
5. The demo baseline stays byte-identical.

## First implementation slice after acceptance

One PR, in `@age/scored-bif-snapshot-persistence`:

- a `ClientContext`-bound facade over the existing `ScoredBifSnapshotRepository`, with an append
  operation and the three reads, taking `ClientContext` plus non-scope inputs only;
- `@age/capability-kit` added as a dependency of that package;
- tests proving scope comes from `ClientContext`, that a payload cannot influence it, that a foreign
  scope is unreachable through the facade and unrepresentable in its types, and that wrong-client and
  wrong-organization isolation are each expressed as a different `ClientContext`.

Not in it: any caller, any wiring, any `apps/` change, any API/Web/demo-runtime change, any schema,
migration or RLS change, and any change to the port.
