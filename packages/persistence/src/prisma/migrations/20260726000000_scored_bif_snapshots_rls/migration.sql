-- Row-level security for `scored_bif_snapshots` (ADR-0033, accepted as amended).
--
-- This migration adds ONLY policies and privileges. It does not touch the table
-- identity, does not add or alter a column, and does not create a role.
--
-- ROLES ARE NOT HERE ON PURPOSE (ADR-0033 D11). A role is an environment
-- identity, not schema: the same committed SQL has to apply to CI's throwaway
-- database and to any other environment, whose role names and credentials are
-- not this repository's business. Grants and policies ARE schema and do belong
-- in a reviewed migration, which is why they are here.
--
-- THE BOUNDARY IS BOTH IDS (ADR-0033 D2, as amended). ADR-0030 defines snapshot
-- identity as (client_id, organization_id, bif_id, snapshot_id) and ADR-0009
-- makes `ClientContext` authoritative for scope. Enforcing `organization_id`
-- alone would leave cross-client isolation resting on adapter predicates, so
-- both ids are in the predicate and both arrive as their own setting.
--
-- IT FAILS CLOSED (ADR-0033 D7). `current_setting(name, true)` returns NULL
-- when the setting was never set; `NULLIF(..., '')` folds an empty string onto
-- the same NULL. `column = NULL` is NULL, which is not TRUE, so a session that
-- configured neither setting, or only one of them, sees no rows and cannot
-- insert. There is no state in which forgetting a setting yields partial
-- access.
--
-- STILL NO MUTATION PATH. No `UPDATE`, no `DELETE`, no `TRUNCATE`, no
-- `REFERENCES`, and no grant to `PUBLIC`. Together with the absent
-- `updated_at`/`version`/`deleted_at` columns, append-only now holds even
-- against raw SQL issued as the application role (ADR-0031 D6, ADR-0033 D4).

-- EnableRowLevelSecurity
ALTER TABLE "scored_bif_snapshots" ENABLE ROW LEVEL SECURITY;

-- FORCE, so the table owner is subject to its own policies too. Without it a
-- policy behaves differently under migration than under application traffic,
-- and a suite run as the owner would prove nothing (ADR-0033 D6).
ALTER TABLE "scored_bif_snapshots" FORCE ROW LEVEL SECURITY;

-- CreatePolicy
CREATE POLICY "scored_bif_snapshots_select_in_scope" ON "scored_bif_snapshots"
    FOR SELECT
    USING (
        "client_id" = NULLIF(current_setting('age.client_id', true), '')
        AND "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- CreatePolicy
--
-- Reads alone would not be enough: a tenant able to INSERT freely could write
-- rows attributed to another client or organization — rows it could not then
-- see, which makes the corruption silent.
CREATE POLICY "scored_bif_snapshots_insert_in_scope" ON "scored_bif_snapshots"
    FOR INSERT
    WITH CHECK (
        "client_id" = NULLIF(current_setting('age.client_id', true), '')
        AND "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- Grants for the application role, applied only where that role exists.
--
-- The guard is what keeps this file deployable in an environment that has not
-- provisioned `age_app` — a developer's disposable local database, for example.
-- It cannot hide a missing grant in CI: the live RLS suite asserts the exact
-- privilege set, so a skipped grant fails the tests rather than passing quietly.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'age_app') THEN
        GRANT USAGE ON SCHEMA public TO age_app;
        GRANT SELECT, INSERT ON TABLE "scored_bif_snapshots" TO age_app;
    END IF;
END
$$;
