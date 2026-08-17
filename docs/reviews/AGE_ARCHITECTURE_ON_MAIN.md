# AGE — the architecture that exists on `main`

Extracted **verbatim** from the untracked handover (`CLAUDE.md` §4) on 2026-07-31 at `f6ae1c1`,
because that file is capped at ~30k chars and this section is durable rather than per-PR state.

This is a description of **what is on `main` today**. It is not a plan and it authorizes nothing —
authorization lives in the Accepted ADRs and in the handover's boundaries section. Per-PR history
stays in the `*_CHECKPOINT.md` files indexed by the handover's §9.

⚠️ Keep this in step with `main`. A stale architecture note is worse than none, because it reads as
verified fact.

---

## 4. ARCHITECTURE — WHAT EXISTS ON `main`

### 4.1 Business Discovery → scored BIF pipeline (pure, deterministic)

```
BusinessDiscoveryProfile → questionnaire validation → discovery completeness + confidence
 → field-level evidence/provenance → canonical Draft BIF (mapBusinessDiscoveryToBifDraft)
 → BIF root + section confidence (scoreBusinessIntelligenceFramework)
 → ScoredBifContext projection (projectScoredBifContext)
 → the whole chain in one call (produceScoredBifContext)
```

All in **`packages/business-discovery-contracts`** (deps: `@age/bif`, `zod`).
`@age/bif` is **consumed, never modified.**

**`produceScoredBifContext(profile, options)`** → `{ context, mappingMetadata, scoringMetadata }` is
**the ONLY Discovery→BIF mapping in the repo** (#135 deleted legacy Path A outright — no shim, no
alias; a guard test forbids the retired names repo-wide). `sectionDefinitions` is ONE option passed
to both scorer and projector, deliberately not two knobs.

**Sample fixture scores — the honesty proof:** intake `discoveryCompletenessScore` 97 /
`discoveryConfidenceScore` 63, but `bif.completenessScore` **12** (10/84 fields, 7/12 sections) and
`bif.confidenceScore` **17**. Best section `products_services` 63/100; five sections omitted.

**Scoring layer** (`BIF_CONFIDENCE_SCORING_VERSION = '1.0.0'`): field trust =
`CONFIDENCE_TRUST[confidence] × SOURCE_MULTIPLIER[source]`; section =
`round(100 × sqrt(trust × coverage))`, required fields ×2; root = field-count-weighted mean over
**all 12** canonical sections (omitted = 0 at full weight), capped at 40 when nothing has an
independent source. Returns a **new** BIF; input unmutated; `status` stays `Draft`.

### 4.2 Capture orchestration

- **`@age/business-discovery-capture`** — `BusinessDiscoveryScoredBifCaptureOrchestrator`. Sits
  **above** contracts + capability-kit + scored-bif-snapshot-persistence; nothing depends on it.
  Two explicit modes `produceOnly` / `produceAndCapture` — **no default that writes.** The mapper's
  `organizationId` is `?: never` and `clientContext.organizationId` flows in, so scope and payload
  cannot disagree. Missing capture dependency in capture mode **throws**; a real capture failure is
  **returned** with the produced context intact and the error unclassified.
- **`@age/scored-bif-snapshot-persistence`** — `ScoredBifSnapshotCapture`,
  `ClientContextBoundScoredBifSnapshotRepository`, `ScoredBifSnapshotCaptureOrchestrator`
  (returns an outcome, **never throws**), `PrismaScoredBifSnapshotRepository`,
  `ScoredBifSnapshotScopeRunner` (#151). `clientId`/`organizationId` are `?: never` on every facade
  input → cross-tenant access is a **compile error**, not a silent ignore.
- **`apps/capture`** (`@age/capture`, bin `age-capture`) — the CLI. Three modules, three
  responsibilities, **do not merge them**: `capture-runner.ts` owns every **decision** as a pure
  function of `argv` + an injected `CaptureRuntime`; `capture-composition.ts` owns the D6 chain;
  `main.ts` owns every **effect**. ⚠️ **CORRECTED 2026-08-17 — measured against `main`, not against
  this document's own earlier claim.** `capture-composition.ts` is 🚫 **no longer** the only
  production `new PrismaClient(`: ADR-0074's deployed console added
  `deployed-console-composition.ts` and `deployed-session-composition.ts`, which construct it too.
  🛑 **THE INVARIANT THAT ACTUALLY HOLDS IS THE ONE WORTH STATING** — every production
  `new PrismaClient(` in the repository lives inside `apps/capture`, and `@prisma/client` is imported
  by **exactly those three composition modules and nothing else**. 🚫 Do not restore the narrower
  sentence: it was false while reading as an invariant, which is the worst shape a claim can take.
  Barrel exports the
  pure surface only — the composition root is a **separate export path `@age/capture/composition`**,
  so importing the package never drags in `@prisma/client`. Details: checkpoint doc §7.

**The D6 chain:**

```
PrismaClient → ScoredBifSnapshotScopeRunner → ScopedScoredBifSnapshotRepository
  → ScoredBifSnapshotCaptureOrchestrator → BusinessDiscoveryScoredBifCaptureOrchestrator
```

### 4.3 Persistence & RLS

- Schema of record: **`packages/persistence/src/prisma/schema.prisma`** — the **single** schema.
  `prisma-schema-of-record.spec.ts` asserts **exactly one `schema.prisma` repo-wide** and enforces
  ADR-0042 D3's real rule, _schema ownership_: `prisma` (resolves a schema) is banned from `apps/`
  with no allowlist; `@prisma/client` (owns none) is allowlisted to **`apps/capture` alone**, pinned
  by a test so it fails rather than rots. `apps/api/prisma/` is **deleted**.
- `model ScoredBifSnapshot` → table `scored_bif_snapshots`. PK
  `(clientId, organizationId, bifId, snapshotId)`. `capturedAt` is **text** (byte-identical round
  trip; lexicographic == chronological). `context` is **one `jsonb`** column. Index
  `(client, org, bif, capturedAt DESC, snapshotId DESC)`. **No `updatedAt`, no `version`, no
  `deletedAt`, no `current`** — append-only, enforced in the schema.
- Migrations in `packages/persistence/src/prisma/migrations/`. Every Prisma script passes
  `--schema`. Migration SQL is **committed as reviewed source**; `prisma db push` is **forbidden**.
- **RLS:** `ENABLE` + **`FORCE ROW LEVEL SECURITY`**; SELECT (`USING`) and INSERT (`WITH CHECK`)
  both require `client_id` **and** `organization_id` to equal
  `NULLIF(current_setting('age.<id>', true), '')` — NULL is not TRUE, so a missing setting
  **fails closed**. `GRANT SELECT, INSERT` only. **No roles in committed migration SQL** — roles are
  environment identities created by `ci-db.yml` with inline throwaway creds, no repo secret.
- Live DB tests: `*.db.spec.ts`, run only by `test:db` via `vitest.db.config.ts`, in the path-gated
  **`.github/workflows/ci-db.yml`** (`postgres:16-alpine`), whose `paths:` lists include
  `apps/capture/**`. They **throw when `DATABASE_URL` is absent — never skip.** `ci.yml` stays
  DB-free (its `Generate Prisma client` step is schema-only with a placeholder `DATABASE_URL`).
  ⚠️ The capture CLI live spec is hosted at `packages/persistence/src/tests/capture-cli.db.spec.ts`,
  not in the app — `vitest.db.config.ts` would collect it nowhere else.
- JSON types (`JsonValue`/`JsonObject`) defined once in `@age/business-discovery-contracts` with
  **no Prisma import**. `ScoredBifSnapshotRow.context: JsonObject` (write) vs
  `StoredScoredBifSnapshotRow.context: JsonValue` (read) — asymmetric on purpose (ADR-0041 D1/D2).

### 4.4 Capabilities

Six pure capabilities: **Intelligence, Market Discovery, Growth, Authority, Operations, Revenue.**
Each depends only on `@age/capability-kit` + its own contracts package.

Three (Intelligence, Market Discovery, Revenue) adopt the **context-readiness** pattern (ADR-0027):
a **separate named entry point** reading `ScoredBifContext` **solely** to report its own readiness.
**Never a gate on `run`.** No plan/opportunity/action/recommendation may be derived, ranked, named or
hinted at, **in items or in summary text**; a test regex-scans every emitted string.
⚠️ **`output.items` is NOT permanently empty** — `assess-scored-bif-context.ts:285` builds
`BusinessContextSupportItem[]` and returns them at `:333`. ADR-0027's constraint is about item
**content**, not emptiness. **Check content, never length** — a slice checking "is items empty?"
would pass while the real rule is broken.
Thresholds stay **per-capability and published**. `CapabilityRegistryEntry` carries additive optional
**`assessesContext?: ReadonlyArray<string>`**; `consumes` still means "inputs `run` requires" and must
never gain `ScoredBifContext`.

### 4.5 Snapshot contract

`packages/business-discovery-contracts/src/scored-bif-snapshot.ts` —
`SCORED_BIF_SNAPSHOT_VERSION = '1.0.0'`, `toScoredBifSnapshot` / `fromScoredBifSnapshot`,
`serializeScoredBifSnapshot` (sorted keys → byte-stable JSON), and
`assertReadableSnapshotVersion(snapshotVersion, caller)` — called from **both**
`fromScoredBifSnapshot` and `normalizeScoredBifSnapshotRecord`, deliberately **not in the barrel**.
It closes the D4 read-path gap: a row written under a future major would otherwise be read as though
this build understood it, on a table that can never be migrated in place.
**KEY CALL:** the codec round-trips the **`ScoredBifContext` projection**, NOT the live BIF — a BIF
carries `Date`s, per-field version history and audit actors, and restoring one would mean **inventing
that history**. There is deliberately **no context → BIF direction.**

---
