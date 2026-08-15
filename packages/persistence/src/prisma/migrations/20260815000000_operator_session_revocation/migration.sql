-- ADR-0074 §7 slice 2 — THE ONE WRITE `operator_sessions` IS EVER ALLOWED.
--
-- 🛑 WHY THIS MIGRATION EXISTS AT ALL. The 20260811000000 migration granted
-- SELECT and nothing else, and its header says why: "A store the application
-- cannot write cannot quietly grow an issuance path." That reasoning is
-- unchanged and is NOT being relaxed. What changed is that ADR-0074 D3 added a
-- requirement the SELECT-only store cannot meet:
--
--     "logout writes `revokedAt` on the row and the cookie is expired as a
--      consequence … Both must be proven by a presented cookie being REFUSED
--      afterwards — not by a redirect to a login screen."
--
-- A logout that only clears a cookie is not a logout: the token still verifies,
-- and anyone who copied it is still signed in. So the application needs to be
-- able to END a session. It still may not START one.
--
-- 🛑 HOW "END BUT NEVER START" IS EXPRESSED, AND WHY IT IS THE COLUMN GRANT THAT
-- DOES IT. The grant below is `UPDATE ("revoked_at")` — a COLUMN-LEVEL grant.
-- PostgreSQL rejects an UPDATE that touches any other column of this table, so
-- `age_app` cannot move `expires_at` forward, cannot repoint `token_hash`, and
-- cannot re-tenant a row by rewriting `organization_id`. 🚫 There is still no
-- INSERT and no DELETE, so a session cannot be created and cannot be erased:
-- VERIFICATION IS NOT ISSUANCE still holds at the database, which is the only
-- place it holds against code nobody has written yet.
--
-- 🚫 DO NOT WIDEN THIS TO `GRANT UPDATE ON TABLE`. Dropping the column list is a
-- one-word edit that silently turns this into a general write grant, and every
-- test in the repository would still pass.

-- ⚠️ The FOR UPDATE policy is separate from the FOR SELECT one and does not
-- replace it. `USING` decides which rows may be updated; `WITH CHECK` decides
-- what they may become. Both compare the same scope, so a row cannot be updated
-- out of the organization it belongs to — the shape a `USING`-only policy
-- allows, and the reason this one is not written that way.
--
-- ⚠️ `NULLIF(current_setting(...), '')` matches the SELECT policy exactly: an
-- unset scope is NULL, NULL = anything is NULL, and the policy denies. It fails
-- CLOSED, which under FORCE ROW LEVEL SECURITY means an unscoped revocation
-- updates zero rows rather than every row.
CREATE POLICY "operator_sessions_revoke_in_scope" ON "operator_sessions"
    FOR UPDATE
    USING ("organization_id" = NULLIF(current_setting('age.organization_id', true), ''))
    WITH CHECK ("organization_id" = NULLIF(current_setting('age.organization_id', true), ''));

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'age_app') THEN
        -- 🛑 THE COLUMN LIST IS THE CONTROL. 🚫 Never `GRANT UPDATE ON TABLE`.
        GRANT UPDATE ("revoked_at") ON TABLE "operator_sessions" TO age_app;
    END IF;
END $$;
