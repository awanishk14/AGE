-- The first migration in this repository (ADR-0032 D2, D4).
--
-- It creates exactly one table: the immutable, append-only store for scored BIF
-- snapshots that ADR-0030 and ADR-0031 ratified and that PR #106 added to the
-- schema of record. Nothing else. No `HealthCheck`, no grants, no policies.
--
-- APPEND-ONLY IS ENFORCED BY WHAT IS ABSENT. There is deliberately no
-- `updated_at`, no `version`, no `deleted_at`, and no mutable
-- `current`/`is_current` column. A future migration that adds one of those, or
-- that grants UPDATE or DELETE on this table, revokes a ratified guarantee and
-- needs an ADR before it needs a review (ADR-0032 D7).
--
-- `INSERT`/`SELECT`-only grants and RLS policies on `organization_id` are
-- ADR-0031 stage 3b. They are NOT in this migration and are not authorized yet.
--
-- Generated offline, no database contacted (ADR-0032 D5):
--   prisma migrate diff --from-empty \
--     --to-schema-datamodel src/prisma/schema.prisma --script

-- CreateTable
CREATE TABLE "scored_bif_snapshots" (
    "client_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bif_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "captured_at" TEXT NOT NULL,
    "snapshot_version" TEXT NOT NULL,
    "scoring_version" TEXT,
    "context" JSONB NOT NULL,

    CONSTRAINT "scored_bif_snapshots_pkey" PRIMARY KEY ("client_id","organization_id","bif_id","snapshot_id")
);

-- CreateIndex
CREATE INDEX "scored_bif_snapshots_series_latest_idx" ON "scored_bif_snapshots"("client_id", "organization_id", "bif_id", "captured_at" DESC, "snapshot_id" DESC);
