-- The source-observation rows (ADR-0069 §6, deliverable 2).
--
-- WHAT ADR-0069 AUTHORIZED, AND ONLY THIS. One append-only store for what an
-- external system observed. It is not general schema authorization: ADR-0069 D2
-- decided that Derived Intelligence is a COMPUTED PROJECTION, so 🚫 there is no
-- conclusions table here and adding one is a different decision needing its own
-- ADR.
--
-- SELECT AND INSERT, AND NOTHING ELSE. No UPDATE, no DELETE, no TRUNCATE, no
-- REFERENCES, no grant to PUBLIC. Append-only is a design first and a grant
-- second: the columns that would let a row be edited (`updated_at`, `version`,
-- `deleted_at`, a mutable `current` flag) are absent, and the grant is the
-- second lock on the same door. A source that saw something different next month
-- sends a NEW observation; it does not rewrite the old one.
--
-- NO STATUS COLUMN, DELIBERATELY (ADR-0069 D5). SOURCE ARRIVAL IS NEVER
-- CONFIRMATION. There is no `status`, `confirmed`, `accepted`, `dismissed`,
-- `weight`, `trust`, `score` or `confidence` column, because each is a way for
-- an inbound row to promote itself, and the check that reads it is always added
-- later by someone who did not read the ADR.
--
-- THE BOUNDARY IS THE ORGANIZATION (ADR-0062 D1) and there is NO `client_id`.
-- An observation is scoped by whose business it is about; a client is a SUBJECT,
-- never a principal (D2). The absence also keeps ADR-0066 D7 uncrossed BY SHAPE.
--
-- IT FAILS CLOSED, by the same construction the two stores before it use.
-- `current_setting(name, true)` is NULL when never set and `NULLIF(..., '')`
-- folds an empty string onto the same NULL; `column = NULL` is NULL, which is
-- not TRUE. A transaction that forgot to scope itself sees no observations
-- rather than every organisation's.
--
-- ⚠️ RLS HERE IS COHERENCE, NOT AUTHORIZATION (ADR-0046 D5). It keeps a scoped
-- transaction inside its scope; it does not decide who may read. 🚫 Isolation is
-- never proven by RLS, and never by an empty result set.
--
-- NO `DEFAULT now()` ANYWHERE. `recorded_at` is the caller's exact string and is
-- NOT `observed_at` — an operator-mediated relay happens days after the
-- observation by construction, and a self-timestamping row would make every
-- relayed observation look freshly made.

-- CreateTable
CREATE TABLE "source_observations" (
    "observation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_instance" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "subject_disposition" TEXT NOT NULL,
    -- NULL for an unmapped subject, and NULL is the point: 🚫 never a guessed
    -- kind. It is what stops a later query counting an unrelatable observation
    -- as coverage of a service AGE models.
    "subject_kind" TEXT,
    "subject_label" TEXT NOT NULL,
    "claim_direction" TEXT NOT NULL,
    "claim_materiality" TEXT NOT NULL,
    "claim_kind" TEXT NOT NULL,
    "observed_at" TEXT NOT NULL,
    "window_start" TEXT NOT NULL,
    "window_end" TEXT NOT NULL,
    "recorded_at" TEXT NOT NULL,

    CONSTRAINT "source_observations_pkey" PRIMARY KEY ("observation_id")
);

-- A `modelled` row must name its kind and an `unmapped` row must not. Enforced
-- here rather than only in code, because the stored row is read back as
-- UNTRUSTED INPUT and the normalizer must never have to guess which shape it is
-- holding.
ALTER TABLE "source_observations"
    ADD CONSTRAINT "source_observations_subject_shape_check" CHECK (
        ("subject_disposition" = 'modelled' AND "subject_kind" IS NOT NULL)
        OR ("subject_disposition" = 'unmapped' AND "subject_kind" IS NULL)
    );

-- CreateIndex
CREATE INDEX "source_observations_organization_observed_idx"
    ON "source_observations"("organization_id", "observed_at" DESC, "observation_id" DESC);

-- EnableRowLevelSecurity
ALTER TABLE "source_observations" ENABLE ROW LEVEL SECURITY;

-- FORCE, so the table owner is subject to its own policies too. Without it the
-- policy behaves differently under migration than under application traffic, and
-- a suite run as the owner would prove nothing (ADR-0033 D6).
ALTER TABLE "source_observations" FORCE ROW LEVEL SECURITY;

-- CreatePolicy
CREATE POLICY "source_observations_select_in_scope" ON "source_observations"
    FOR SELECT
    USING (
        "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- WITH CHECK and no USING: an INSERT policy has nothing to read. It refuses a
-- row whose `organization_id` disagrees with the scope the transaction set,
-- which is how a caller is prevented from writing an observation into another
-- organisation's scope while correctly inside its own.
CREATE POLICY "source_observations_insert_in_scope" ON "source_observations"
    FOR INSERT
    WITH CHECK (
        "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- Grants for the application role, applied only where that role exists.
--
-- The guard keeps this file deployable in an environment that has not
-- provisioned `age_app`. It cannot hide a missing grant in CI: the live suite
-- asserts the exact privilege set, so a skipped grant fails the tests rather
-- than passing quietly.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'age_app') THEN
        GRANT USAGE ON SCHEMA public TO age_app;
        GRANT SELECT, INSERT ON TABLE "source_observations" TO age_app;
    END IF;
END
$$;
