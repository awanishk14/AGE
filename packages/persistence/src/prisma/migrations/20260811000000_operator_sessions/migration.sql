-- The session-store rows (ADR-0061 A2, ADR-0068 §0.1b).
--
-- WHAT ADR-0068 LOWERED, AND ONLY THIS. §0.1b authorized the session store's
-- rows — this model, this migration and RLS on THIS STORE. It is not general
-- schema authorization, and it is not a login: §0.1c still refuses every
-- provisioning surface, every sign-in route and every issuance path by name.
--
-- SELECT ONLY, AND THAT IS THE POINT. AGE never issues, revokes or provisions a
-- session — 🛑 VERIFICATION IS NOT ISSUANCE. The second operator's row is
-- planted out of band, as an ACT, by someone with an owner connection. The
-- application role is therefore granted SELECT and nothing else: no INSERT, no
-- UPDATE, no DELETE, no TRUNCATE, no REFERENCES, no grant to PUBLIC. A store the
-- application cannot write cannot quietly grow an issuance path, because the
-- function that would do it fails at the database.
--
-- THE BOUNDARY IS THE ORGANIZATION (ADR-0062 D1). The tenant is the
-- organization, so `organization_id` alone is the predicate here — unlike
-- `scored_bif_snapshots`, whose identity is scoped by client as well. A session
-- belongs to no client: it says who is asking, and a client is a SUBJECT, never
-- a principal (ADR-0062 D2).
--
-- IT FAILS CLOSED. `current_setting(name, true)` is NULL when the setting was
-- never set and `NULLIF(..., '')` folds an empty string onto the same NULL;
-- `column = NULL` is NULL, which is not TRUE. A transaction that forgot to scope
-- itself sees no sessions rather than all of them.
--
-- ⚠️ RLS HERE IS COHERENCE, NOT AUTHORIZATION (ADR-0046 D5). It keeps a scoped
-- transaction from reading outside its scope; it does not decide who may read.
-- 🚫 The isolation this slice claims is never proven by RLS, and never by an
-- empty result set.
--
-- NO `DEFAULT now()` ANYWHERE. Every instant on a row is the exact string the
-- act supplied. A column that timestamps itself is a fact the database invented.

-- CreateTable
CREATE TABLE "operator_sessions" (
    "session_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issued_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "revoked_at" TEXT,

    CONSTRAINT "operator_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
--
-- Unique, so one presented token can match at most one session. Without it two
-- rows could share a digest and "which session is this" would have two answers.
CREATE UNIQUE INDEX "operator_sessions_token_hash_key" ON "operator_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "operator_sessions_organization_idx" ON "operator_sessions"("organization_id");

-- EnableRowLevelSecurity
ALTER TABLE "operator_sessions" ENABLE ROW LEVEL SECURITY;

-- FORCE, so the table owner is subject to its own policies too. Without it the
-- policy behaves differently under migration than under application traffic, and
-- a suite run as the owner would prove nothing (ADR-0033 D6).
ALTER TABLE "operator_sessions" FORCE ROW LEVEL SECURITY;

-- CreatePolicy
--
-- SELECT is the only policy, because SELECT is the only thing AGE does here.
-- There is deliberately no INSERT policy: a policy that permits nothing is
-- indistinguishable from one that was forgotten, and the absent GRANT is the
-- honest statement.
CREATE POLICY "operator_sessions_select_in_scope" ON "operator_sessions"
    FOR SELECT
    USING (
        "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- Grants for the application role, applied only where that role exists.
--
-- The guard keeps this file deployable in an environment that has not
-- provisioned `age_app` — a developer's disposable local database. It cannot
-- hide a missing grant in CI: the live suite asserts the exact privilege set, so
-- a skipped grant fails the tests rather than passing quietly.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'age_app') THEN
        GRANT USAGE ON SCHEMA public TO age_app;
        GRANT SELECT ON TABLE "operator_sessions" TO age_app;
    END IF;
END
$$;
