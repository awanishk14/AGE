# ADR-0041 — Scored BIF Snapshot Context JSON Type Boundary

- Status: Accepted
- Date: 2026-07-26
- Related: ADR-0029, ADR-0030, ADR-0031, ADR-0032, ADR-0034, ADR-0035, ADR-0040, PR #109 finding 2

## Acceptance note

ADR-0041 is accepted as the governing decision for the scored BIF snapshot context JSON type
boundary. It ratifies a Prisma-compatible JSON value type for ScoredBifSnapshotRow.context without
importing generated Prisma types into pure contracts, preserves JSONB single-column context storage,
preserves serializer behavior, and authorizes only the type-boundary cleanup needed to remove unsafe
durable adapter casts where possible. It does not authorize schema or migration changes, RLS changes,
API/Web exposure, workspace implementation, Draft → Active promotion, or runtime caller wiring.

## Context

`ScoredBifSnapshotRow.context` is typed `unknown`. `unknown` is wider than the JSON values Prisma
accepts as input, so the durable adapter cannot be handed a generated Prisma delegate without a
cast. PR #109 recorded this as finding 2 and deliberately left it: changing the row type is an
adapter API change, and that slice was not authorized to make one.

The cast it left behind is not narrow. It is:

```ts
const delegate = prisma.scoredBifSnapshot as unknown as ScoredBifSnapshotDelegate;
```

An `as unknown as` over the whole delegate suppresses **every** structural disagreement, not just the
JSON one. That matters more than the tidiness of one line: `ScoredBifSnapshotDelegate` is the
interface that withholds `update`, `delete` and `upsert` from the adapter (ADR-0031 D8), and a
blanket cast is exactly the instrument that would hide a future divergence in that interface. The
type-level guarantee is currently asserted, not checked.

### Verified repository state

Each of the following was established by generating the Prisma client (v5.22.0) against the schema of
record and compiling probe assignments under the repository's own `tsconfig.db.json`. The probes were
deleted; the findings are what survive.

1. **`ScoredBifContext` is an `interface`** (`packages/business-discovery-contracts/src/scored-bif-context.ts`)
   with an optional member (`metadata.scoringVersion?`). TypeScript gives interfaces no implicit index
   signature, so `ScoredBifContext` is assignable to **neither** `Prisma.InputJsonValue` nor any
   index-signature JSON object type. Confirmed by compile error, not assumed.
2. **A locally declared JSON type IS accepted by Prisma.** An interface with
   `readonly [key: string]: JsonValue | undefined` is assignable to `Prisma.InputJsonValue`, and
   `Prisma.JsonValue` is assignable to a local `JsonValue`. Both directions compile with **zero
   Prisma imports**. The generated types are structurally reachable without being named.
3. **The delegate cast can be removed entirely.** A probe declaring the row's write context as a local
   JSON object type and its read context as a local JSON value type made
   `const delegate: Delegate = prisma.scoredBifSnapshot` compile with **no cast of any kind**.
4. **The JSON type is not the only obstacle.** The same probe also had to change `findMany`'s
   `orderBy` from `ReadonlyArray<…>` to a mutable array: Prisma's `orderBy` input is a mutable array
   type and a `readonly` array is not assignable to it. PR #109 reported `create` as the single point
   of rejection; that was true of `create` in isolation and incomplete for the interface as a whole.
   Removing the cast requires both changes.
5. **One conversion cannot be removed, for a reason inside the payload.**
   `ScoredBifContextField.value` is `unknown` (`scored-bif-context.ts`). Because a leaf of the context
   is `unknown`, **no** type-level projection of `ScoredBifContext` can prove JSON-safety — a mapped
   `Jsonify<T>` collapses that leaf to `never`. What proves JSON-safety today is runtime validation:
   `assertJsonSafe` in `scored-bif-snapshot.ts` rejects `Date`, functions, `undefined`, symbols,
   non-finite numbers, class instances and cycles, and `normalizeScoredBifSnapshotRecord` returns a
   frozen JSON-safe copy. That is by design — field values are heterogeneous BIF values — and making
   it provable at the type level would mean narrowing `ScoredBifContextField.value`, which changes
   `ScoredBifContext`.

Also present, and deliberately left alone: `packages/business-discovery-contracts/src/scored-bif-snapshot.ts`
already declares a private `JsonValue` used by `serializeScoredBifSnapshot`. The repository does not
need a second, competing definition of "JSON".

## Decision

### D1 — Split the context type by direction, write and read

`context` is narrow on the way **in** and wide on the way **out**. A row being written is a JSON
object the caller is asserting; a row read back is untrusted data of unknown shape (ADR-0031 D11).
Collapsing both into one type would either weaken the write side back to `unknown` or make the read
side claim a guarantee the database does not offer. Prisma models the same asymmetry with
`InputJsonValue` versus `JsonValue`; this mirrors it in our own vocabulary.

### D2 — The write type is a JSON **object** type, not a JSON value type

A snapshot context is always an object. Typing the write side as a full JSON value would permit a
bare string, number, boolean, array or `null` as a stored context, none of which is a
`ScoredBifContext`. It also avoids a concrete Prisma hazard: a top-level `null` is not
`InputJsonValue` — Prisma requires its `JsonNull` sentinel — so a write type that admits `null`
reintroduces the assignability failure this ADR exists to remove.

Explicitly decided, per the question asked of this ADR: at the **top level**, objects are accepted and
arrays, strings, numbers, booleans and `null` are rejected. **Nested** inside the object, all JSON
values including `null` and nested arrays are accepted. On the **read** side the full JSON value type
is accepted, because that is what a database column can actually return.

### D3 — The JSON types live in `@age/business-discovery-contracts`, and Prisma is never imported

They belong at the lowest boundary that already owns the concept. That package already defines a
private `JsonValue` for the serializer and already owns `ScoredBifSnapshot`. The implementation should
**reuse and export that existing type** rather than declare a second one; if its exact variance
(mutable versus `readonly` arrays) does not satisfy both directions, the implementation may adjust the
declaration or declare the object type alongside it — but it must not end with two competing
definitions of JSON in the repository.

`@prisma/client` and generated Prisma types are **not** imported into contracts, and this costs
nothing: finding 2 proves compatibility is structural. Importing them would also break the package's
purity guard, which names `@prisma/client` explicitly, and would make contracts typecheck depend on a
generation step.

### D4 — The narrow delegate interface is corrected, not widened

`orderBy` becomes a mutable array so the generated delegate satisfies the interface. This is a
variance fix, not a capability change: no method is added. `update`, `updateMany`, `upsert`, `delete`
and `deleteMany` remain absent, and the existing test asserting that the generated delegate _does_
have them — while the port withholds them — remains the guard on that.

### D5 — Exactly one conversion remains, at the mapper, and it is named

Because of finding 5, `toScoredBifSnapshotRow` cannot assign a `ScoredBifContext` to the write type
without an assertion. The cast does not disappear; it **moves and shrinks**, from a blanket
`as unknown as` over an entire interface to one documented line at the point where
`normalizeScoredBifSnapshotRecord` has already proved JSON-safety at runtime.

This is stated plainly rather than presented as a clean win. The trade is real and worth making: a
suppression that hides all future structural drift in the delegate is replaced by a single assertion
about a value a runtime validator has already checked.

### D6 — Nothing else changes

No schema change. No migration. No RLS change. No serializer behaviour change. No change to
`ScoredBifContext`. No change to the repository port, the capture class, either orchestrator, or any
input they accept. No runtime caller is wired. This is a type boundary and nothing else.

## Answers to the questions asked of this ADR

1. **What type should `ScoredBifSnapshotRow.context` use?** A JSON **object** type on write and a JSON
   **value** type on read (D1, D2), replacing `unknown`.
2. **Where should the JSON value type live?** `@age/business-discovery-contracts`, reusing the type the
   serializer already has (D3).
3. **May contracts import `@prisma/client` or generated Prisma types?** No — and it does not need to.
   Compatibility is structural, proven by compilation (finding 2, D3).
4. **How does this preserve package purity?** No new dependency in any package; contracts gains no
   import at all; the purity guard naming `@prisma/client` stays true and untouched.
5. **Does this change the database schema?** No. `context` remains one `jsonb` column, never shredded
   (ADR-0031 D7). No migration is authored.
6. **Does this change the serializer?** No. `serializeScoredBifSnapshot` keeps sorting keys and
   producing byte-stable output. Its type may be exported; its behaviour is not touched.
7. **Does this change `ScoredBifContext`?** No. Narrowing `ScoredBifContextField.value` would make the
   remaining conversion unnecessary, and is deliberately **out of scope** — it is a contracts change
   with consumers beyond persistence and needs its own decision (open question 1).
8. **Does this change capture/orchestrator inputs?** No. `ScoredBifSnapshotCapture`,
   `ScoredBifSnapshotCaptureOrchestrator` and `BusinessDiscoveryScoredBifCaptureOrchestrator` keep
   their signatures and behaviour exactly.
9. **Does this affect live PostgreSQL tests?** They must stay green, and they are where the benefit is
   observable: the `as unknown as ScoredBifSnapshotDelegate` casts in
   `scored-bif-snapshot.db.spec.ts` and `scored-bif-snapshot-rls.db.spec.ts` should become direct
   assignments. No stored data changes, so no assertion about values should need loosening. The
   path-gated database workflow will run.
10. **What is the first implementation slice after acceptance?** One PR: export/settle the JSON types
    in contracts; split `ScoredBifSnapshotRow` into write and read context types; fix `orderBy`
    variance; remove the delegate casts; add type-level tests. Nothing else.

## Consequences

- The generated Prisma delegate is checked against the narrow port instead of asserted to match it.
- A future divergence in `ScoredBifSnapshotDelegate` becomes a compile error at the composition root
  rather than a silent success.
- One documented conversion remains at the mapper, backed by runtime validation.
- Type-level tests can express what was previously only a runtime rule: `Date`, functions, `undefined`
  and symbols are not JSON, and cannot be typed as a write context.

## Non-goals

No API/Web exposure. No workspace. No `Draft → Active` promotion. No runtime caller wiring. No
schema, migration or RLS change. No `@age/persistence` generalisation. No change to what is stored,
only to what the compiler knows about it.

## Stop conditions for the implementation slice

Stop and ask if the narrowing turns out to require changing `ScoredBifContext`, a schema or migration
change, generated Prisma types inside pure contracts, a broader adapter redesign, a change to capture
or orchestrator APIs, a change in serializer semantics, or more than one focused PR.

## Open questions

1. Should `ScoredBifContextField.value` be narrowed from `unknown` to a JSON value type? It would
   remove the last conversion, but it is a contracts change affecting every capability that reads a
   context, and it is not persistence's decision to make alone.
2. Should the read type be narrower than "any JSON value" once a row has passed
   `normalizeScoredBifSnapshotRecord`? Today the re-validation happens after the row type is already
   discarded, so the question is about ordering, not safety.
