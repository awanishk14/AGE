-- ADR-0082 (Accepted 2026-08-19, OPTION A) — a platform operator's session
-- carries NO organization, and is reached by its OWN DIGEST or 🚫 not at all.
--
-- 🛑 **WHAT THE OWNER DECIDED, IN THEIR WORDS: "no organisation id".** So the
-- column becomes nullable and a platform session stores NULL. 🚫 It does NOT
-- store a reserved literal: NULL never equals anything, which is exactly why
-- every tenant policy below continues to match precisely the rows it matched
-- before this migration — 🚫 not one row more. A string like 'superadmin' DOES
-- equal things, and every tenant policy would then treat the platform operator
-- as a real-but-empty tenant, turning refusals into blank working screens.
--
-- 🛑 **THE FENCE IS THE TOKEN DIGEST, AND THAT IS THE WHOLE DESIGN.** The three
-- policies below are gated on `age.platform_session_token_hash`, a setting the
-- caller can only fill in from a credential it was ALREADY PRESENTED (or, at
-- issuance, one it just minted). ⚠️ So no caller can ask "which platform
-- sessions exist" — it can only ask about the one digest in its hand. This is
-- ADR-0080's shape one layer down, and 🚫 it is NOT `age.organization_id` with
-- an agreed sentinel value, which would be the reserved literal by another
-- route (ADR-0082 D3).
--
-- 🚫 **NO EXISTING POLICY IS TOUCHED, WIDENED OR REPLACED** (ADR-0082 D2).
-- These are ADDITIONAL policies. PostgreSQL ORs permissive policies together,
-- so a transaction that does not set `age.platform_session_token_hash` behaves
-- EXACTLY as it did before — every tenant select, insert and revoke is
-- byte-for-byte unchanged, and that is asserted against a live PostgreSQL
-- rather than reasoned about.
--
-- 🚫 **NO NEW GRANT.** `age_app` already holds SELECT, INSERT, and
-- UPDATE ("revoked_at") on this table, and 🚫 that column list is still the
-- control. AGE can start a platform session and end one; 🚫 it still cannot
-- extend one, repoint one, re-tenant one or erase one. **AGE mints nothing
-- new here** — provisioning the ACCOUNT and the MEMBERSHIP that make a person a
-- platform operator remains a human act.

-- AlterTable
--
-- 🛑 **DROP NOT NULL IS THE WHOLE SCHEMA CHANGE, AND IT IS 🚫 NOT A LOOSENING
-- OF THE TENANT RULE.** A tenant session still cannot be written with a NULL
-- organization: `operator_sessions_issue_in_scope` compares the column for
-- equality, NULL = anything is NULL, and `WITH CHECK` refuses a row that does
-- not satisfy it. So the nullability is reachable ONLY through the platform
-- policy below, which additionally requires the digest fence. ⚠️ The column
-- being nullable is a fact about platform sessions, 🚫 not a missing value, and
-- 🚫 no reader may default or coalesce it into a tenant (ADR-0082 D4).
ALTER TABLE "operator_sessions" ALTER COLUMN "organization_id" DROP NOT NULL;

-- CreatePolicy
--
-- ⚠️ **VERIFICATION RUNS ON EVERY REQUEST, AND THIS IS WHAT IT READS.** The
-- caller hashes the presented token and sets the digest; the database returns
-- that row or nothing. 🚫 It cannot enumerate, because `token_hash` is UNIQUE
-- and the predicate is equality against a value the caller supplied.
--
-- ⚠️ **REVOKED AND EXPIRED ROWS ARE DELIBERATELY STILL VISIBLE HERE**, exactly
-- as they are to the tenant SELECT policy. 🚫 Revocation and expiry are NOT
-- enforced by hiding the row: `@age/session-store` has one implementation of
-- each decision, and a policy that hid a revoked row would report it as
-- `no-such-session` — collapsing "AGE holds a row it has decided against" into
-- "AGE holds no such row", which is the distinction the verifier exists to make.
CREATE POLICY "operator_sessions_select_platform_session" ON "operator_sessions"
    FOR SELECT
    USING (
        "operator_sessions"."organization_id" IS NULL
        AND "operator_sessions"."token_hash"
            = NULLIF(current_setting('age.platform_session_token_hash', true), '')
    );

-- CreatePolicy
--
-- 🛑 **`WITH CHECK` AND 🚫 NO `USING`**, matching `operator_sessions_issue_in_scope`
-- and for the same reason: on a `FOR INSERT` policy there is no existing row to
-- test, so what is tested is what the row MAY BECOME.
--
-- 🛑 **THE DIGEST IS PINNED, SO THIS INSERT CANNOT BE POINTED SOMEWHERE ELSE.**
-- The issuing transaction sets the setting from the digest of the token it just
-- minted, and the row must carry that same digest. ⚠️ A transaction that forgot
-- to set it compares against NULL and the insert is REFUSED — loudly, rather
-- than landing an unscoped session nobody can account for.
--
-- ⚠️ **`organization_id IS NULL` IS REQUIRED HERE**, so this policy can never be
-- the route by which a TENANT session is written. The two insert policies are
-- disjoint by construction: one demands a matching organization, the other
-- demands none at all.
CREATE POLICY "operator_sessions_issue_platform_session" ON "operator_sessions"
    FOR INSERT
    WITH CHECK (
        "operator_sessions"."organization_id" IS NULL
        AND "operator_sessions"."token_hash"
            = NULLIF(current_setting('age.platform_session_token_hash', true), '')
    );

-- CreatePolicy
--
-- ⚠️ **LOGOUT MUST WORK FOR A PLATFORM OPERATOR TOO**, and ADR-0074 D3 is not
-- suspended for them: a logout that only clears a cookie is not a logout,
-- because the token still verifies. The person logging out is presenting the
-- token, so the same digest fence applies with nothing added.
--
-- ⚠️ **BOTH `USING` AND `WITH CHECK`**, matching `operator_sessions_revoke_in_scope`.
-- `USING` decides which rows may be updated; `WITH CHECK` decides what they may
-- become. Both demand a NULL organization, so 🚫 a platform session cannot be
-- updated INTO a tenant — the shape a `USING`-only policy would allow, and the
-- reason this one is not written that way. ⚠️ The grant is still
-- `UPDATE ("revoked_at")`, so `organization_id` and `token_hash` are unwritable
-- regardless of what any policy permits; the clauses here are the second fence,
-- 🚫 not the first.
CREATE POLICY "operator_sessions_revoke_platform_session" ON "operator_sessions"
    FOR UPDATE
    USING (
        "operator_sessions"."organization_id" IS NULL
        AND "operator_sessions"."token_hash"
            = NULLIF(current_setting('age.platform_session_token_hash', true), '')
    )
    WITH CHECK (
        "operator_sessions"."organization_id" IS NULL
        AND "operator_sessions"."token_hash"
            = NULLIF(current_setting('age.platform_session_token_hash', true), '')
    );
