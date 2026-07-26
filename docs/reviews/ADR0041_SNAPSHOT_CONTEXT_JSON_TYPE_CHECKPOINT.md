# ADR-0041 Checkpoint — Scored BIF Snapshot Context JSON Type Boundary

Records the ADR-0041 track: why it existed, what shipped, the two findings that changed the shape of
the work, and what it deliberately left undone. Written at `main` @ `4b9a5ab`, after all three PRs
merged.

## 1. Where this came from

PR #109 delivered the first Prisma-backed snapshot adapter and reported, as **finding 2**, that a
generated `PrismaClient.scoredBifSnapshot` did not quite satisfy the adapter's narrow delegate
interface. `ScoredBifSnapshotRow.context` was `unknown`, which is wider than the JSON Prisma accepts
as `create` input. That slice was not authorized to change an adapter API, so it left the problem
recorded rather than solved, behind this line in both live database specs:

```ts
const delegate = prisma.scoredBifSnapshot as unknown as ScoredBifSnapshotDelegate;
```

The reason this was worth a track of its own is not tidiness. `ScoredBifSnapshotDelegate` is the
interface that **withholds** `update`, `delete` and `upsert` from the adapter (ADR-0031 D8) — it is
the type-level half of the append-only guarantee. An `as unknown as` over the whole delegate
suppresses every structural disagreement, so the one construct that would hide a future divergence in
that interface was sitting directly on top of it. The guarantee was asserted, not checked.

## 2. Merge ledger

| PR   | Branch                                               | Commit    | Merge     | What                                       |
| ---- | ---------------------------------------------------- | --------- | --------- | ------------------------------------------ |
| #140 | `docs/adr0041-scored-bif-snapshot-context-json-type` | `8afd0a0` | `c85c6e8` | ADR-0041 `Status: Proposed`                |
| #141 | `docs/accept-adr0041`                                | `191f85a` | `4decbad` | `Status: Accepted`, user's acceptance note |
| #142 | `refactor/scored-bif-snapshot-context-json-type`     | `7d1c94f` | `4b9a5ab` | The implementation — 9 files, +335/−42     |

PR #142's CI: `Lint, Typecheck, Test, Build` pass 5m22s, `Migration and live PostgreSQL tests` pass
42s (49 tests, no skips). Post-merge `CI` and `CI (live database)` both SUCCESS.

## 3. What the ADR was decided on, and how

Every claim in ADR-0041's "Verified repository state" was established by generating the Prisma client
(v5.22.0) against the schema of record and compiling probe assignments under the repository's own
`tsconfig.db.json`. The probes were then deleted. This matters to record: the alternative was to
reason about Prisma's generated types from documentation, and two of the five findings contradict
what that reasoning would have produced.

1. `ScoredBifContext` is an `interface`, and TypeScript gives interfaces no implicit index signature —
   so it is assignable to **neither** `Prisma.InputJsonValue` nor any index-signature JSON object
   type. Confirmed by compile error.
2. A **locally declared** JSON type is accepted by Prisma in both directions, with **zero Prisma
   imports**. The generated types are structurally reachable without being named — which is what made
   D3 (no `@prisma/client` in contracts) cost nothing.
3. The delegate cast could be removed **entirely**, not merely narrowed.
4. **The JSON type was not the only obstacle** — see §5, finding 1.
5. **One conversion cannot be removed**, for a reason inside the payload — see §5, finding 2.

## 4. What shipped (PR #142)

**One definition of JSON, in `@age/business-discovery-contracts`.** The package already had a private
`JsonValue` serving `serializeScoredBifSnapshot`; ADR-0041 D3 required reusing and exporting it rather
than declaring a second. Both are now exported from `scored-bif-snapshot.ts`:

```ts
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}
```

The `| undefined` on the index signature is not decoration: it is what makes a shape like
`metadata.scoringVersion?: string` assignable at all.

**The row type is split by direction** (D1, D2), in
`packages/scored-bif-snapshot-persistence/src/scored-bif-snapshot-row.ts`:

| Type                         | `context`    | Why                                                                  |
| ---------------------------- | ------------ | -------------------------------------------------------------------- |
| `ScoredBifSnapshotRow`       | `JsonObject` | A row being written is a JSON object the caller is asserting         |
| `StoredScoredBifSnapshotRow` | `JsonValue`  | A row read back is untrusted data of whatever shape the column holds |

The asymmetry is deliberate and mirrors Prisma's own `InputJsonValue` versus `JsonValue`. The write
side is an **object** type rather than a value type for a concrete reason: a top-level `null` is not
`InputJsonValue` — Prisma requires its `JsonNull` sentinel — so a write type admitting `null` would
reintroduce the exact assignability failure the ADR existed to remove. Nested `null` and arrays are
accepted; only the top level is constrained.

**Both casts are gone.** In `scored-bif-snapshot.db.spec.ts` and `scored-bif-snapshot-rls.db.spec.ts`
the delegate is now a plain typed declaration:

```ts
const delegate: ScoredBifSnapshotDelegate = prisma.scoredBifSnapshot;
```

Proven against a real generated client under `typecheck:db`, not against a hand-written double.

**Tests: 140 → 153** in `@age/scored-bif-snapshot-persistence`, via the new
`scored-bif-snapshot-row-json-type.spec.ts` (13 tests, mostly `@ts-expect-error`). Contracts stayed at
282, API at 36, demo output byte-identical.

The `@ts-expect-error` style is load-bearing rather than decorative: an **unused** `@ts-expect-error`
is itself a compile error, so `tsc` fails the moment any of those rejections stops happening. That is
how the file asserts things a runtime test cannot reach — that `Date`, functions, symbols and
`bigint` are not JSON and cannot be typed as a write context.

## 5. Two findings worth carrying forward

**1. PR #109's report was very nearly right, and incomplete.** It named `create` as the single point
of rejection. True of `create` in isolation; false of the interface as a whole. Removing the cast
needed **two** fixes, not one — the JSON narrowing _and_ `findMany`'s `orderBy`, which was declared
`ReadonlyArray<…>` while Prisma's `orderBy` input is a mutable array type, and a `readonly` array is
not assignable to it. ADR-0041 D4 classified that as a variance fix rather than a capability change:
no method was added, and `update`, `updateMany`, `upsert`, `delete` and `deleteMany` remain absent.

The general lesson is the one the probes taught: a finding recorded from a partial compile is a
hypothesis about the rest of the interface, not a measurement of it.

**2. Exactly one conversion remains, and it is not removable from this side of the boundary.**
`ScoredBifContextField.value` is `unknown`. Because a leaf of the context is `unknown`, **no**
type-level projection of `ScoredBifContext` can prove JSON-safety — a mapped `Jsonify<T>` collapses
that leaf to `never`. So `toScoredBifSnapshotRow` still contains one assertion:

```ts
const jsonContext = context as unknown as JsonObject;
```

This is stated as a trade rather than a win, which is how ADR-0041 D5 framed it. What proves
JSON-safety is runtime validation — `assertJsonSafe` rejects `Date`, functions, `undefined`, symbols,
non-finite numbers, class instances and cycles, and `normalizeScoredBifSnapshotRecord` returns a
frozen JSON-safe copy. The cast **moved and shrank**: from a blanket suppression over an entire
interface, to one documented line at the point where a validator has already checked the value. A
suppression that would hide all future structural drift in the delegate was replaced by a single
assertion about an already-checked value.

`ScoredBifContext` was deliberately **not** changed. Narrowing `ScoredBifContextField.value` would
remove the last conversion, but it is a contracts change affecting every capability that reads a
context, and it is not persistence's decision to make alone.

## 6. Boundaries held

No schema change, no migration, no RLS change. No serializer behaviour change — `serializeScoredBifSnapshot`
still sorts keys and produces byte-stable output; only its types were exported. No change to
`ScoredBifContext`, the repository port, `ScoredBifSnapshotCapture`, either orchestrator, or any input
they accept. No API, Web or workspace change. No `Draft → Active`. **No runtime caller was wired** —
that residual is unchanged from ADR-0040 and is not this track's to close.

Contracts gained no import at all, so the package purity guard naming `@prisma/client` stays true and
untouched.

## 7. Open questions, still open

1. **Should `ScoredBifContextField.value` be narrowed from `unknown` to a JSON value type?** It would
   remove the last conversion. It is a contracts change with consumers beyond persistence, so it needs
   its own decision.
2. **Should the read type be narrower than "any JSON value"** once a row has passed
   `normalizeScoredBifSnapshotRecord`? Today the re-validation happens after the row type has already
   been discarded, so the question is about ordering, not safety.

Both are recorded in ADR-0041 and neither was touched by the implementation.

## 8. State at the time of writing

`main` @ `4b9a5ab`. The ADR-0041 track is complete and its authorization is exhausted. The next track
(ADR-0042, the `apps/api` placeholder Prisma schema) is a separate decision and is tracked separately.
