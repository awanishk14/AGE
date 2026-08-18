-- ADR-0079 slice 2 of §6 — ACCOUNTS, MEMBERSHIPS, AND THE ONE INSERT
-- `operator_sessions` is ever allowed.
--
-- 🛑 WHAT ADR-0079 OVERTURNED, AND ONLY THIS. §3 of that ADR replaces one
-- shipped refusal:
--
--     "AGE mints nothing" → "AGE MAY ISSUE A SESSION after verifying an
--      external identity. ⚠️ `GRANT INSERT` on the sessions table becomes
--      necessary — 🛑 and the column-scoped `UPDATE ("revoked_at")` STAYS."
--
-- The ADR was a decision request for the Product Owner and was answered by
-- them, verbatim, in its §0.2. 🚫 Nothing else in the 20260811000000 header is
-- relaxed: there is still no DELETE, still no TRUNCATE, still no grant to
-- PUBLIC, and the UPDATE grant is still one column wide.
--
-- 🛑 ISSUANCE IS NOT PROVISIONING, AND THE TWO ARE SEPARATED BY THE GRANTS
-- BELOW. AGE may now START A SESSION for an account that already exists. It
-- still may not CREATE THE ACCOUNT: `accounts` and `account_memberships` hold
-- `GRANT SELECT` and nothing else, so who exists and what they may reach remain
-- human acts performed out of band with an owner connection. 🚫 That is not an
-- oversight for a later migration to "complete" — `account.provision` is the
-- right to ASK for provisioning (see `@age/access-scope`), and ADR-0079
-- authorized no path for it.
--
-- ⚠️ THE AGENCY IS THE ORGANIZATION (ADR-0062 D1), AND THIS MIGRATION SAYS SO
-- IN COLUMN NAMES RATHER THAN IN PROSE. `@age/access-scope` names its axis
-- `agencyId` because that is the word ADR-0079 uses; the tenant boundary
-- already shipped, everywhere, as `organization_id`, and every policy in this
-- database compares `age.organization_id`. Introducing a second tenancy axis to
-- match a package's vocabulary would give AGE two answers to "whose data is
-- this". So the column is `organization_id`, and binding the two names is the
-- composition slice's job (slice 4), 🚫 not this one's.
--
-- IT FAILS CLOSED, identically to the policies already here:
-- `current_setting(name, true)` is NULL when unset, `NULLIF(..., '')` folds the
-- empty string onto the same NULL, and `column = NULL` is not TRUE. An unscoped
-- transaction sees nothing and writes nothing.
--
-- ⚠️ RLS HERE IS COHERENCE, NOT AUTHORIZATION (ADR-0046 D5). Who may sign in is
-- decided above this layer; these policies only keep a scoped transaction
-- inside its scope. 🚫 The isolation this slice claims is proven by neither RLS
-- nor an empty result set — the live suite pairs every "cannot see" with an
-- owner-side count.
--
-- NO `DEFAULT now()` AND NO FOREIGN KEYS. Every instant is the exact string the
-- act supplied, as everywhere else in this schema. The absent FK from
-- `operator_sessions.account_id` to `accounts.account_id` is deliberate: the
-- sessions table predates this one and already holds rows, and a constraint
-- added here would either fail the deploy or quietly rewrite history to satisfy
-- itself. Slice 3, where a session is first issued FOR an account, is where
-- that relationship becomes assertable.

-- CreateTable
--
-- 🚫 THERE IS NO CREDENTIAL COLUMN, AND THERE IS NOT GOING TO BE ONE HERE.
-- ADR-0079 D3 — whether Google sign-in covers all three scopes or staff only —
-- is still the owner's and is unanswered. A `password_hash` column added "for
-- later" is a column something eventually writes to; AGE's own code never
-- compares a password (ADR-0061 A2), and an empty column is the invitation.
CREATE TABLE "accounts" (
    "account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "disabled_at" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("account_id")
);

-- Unique, so one external identity resolves to at most one account. Without it
-- "who is this" would have two answers, which is the failure the unique token
-- digest already exists to prevent one table over.
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateTable
--
-- 🛑 THE MEMBERSHIP CARRIES THE SCOPE, AND THE SESSION DOES NOT. A session says
-- WHO is asking (ADR-0062 D3: no role, no `isAdmin`, no permission list on a
-- session), so what they may reach is read from HERE, on every request, rather
-- than carried inside the credential. That is the property adopted from the
-- peer product and recorded in ADR-0079 §2: scope is read from the database per
-- request, 🚫 never from a claim inside a token.
--
-- 🛑 THE SHAPE CONSTRAINT IS THE LOAD-BEARING PART. A client membership that
-- forgot its `client_id` would be an agency-wide membership wearing the word
-- "client", and it would widen silently. The CHECK below makes each of the
-- three shapes the only shape its kind can take, at the database, where it
-- holds against code nobody has written yet.
--
-- ⚠️ A PLATFORM MEMBERSHIP HAS NO ORGANIZATION, AND THAT IS WHY IT IS INVISIBLE
-- TO EVERY SCOPED READ. `organization_id` is NULL for it and the policy below
-- compares equality — so no tenant-scoped transaction can learn that platform
-- operators exist, let alone who they are. Reaching a platform membership needs
-- an unscoped path that is deliberately not built yet.
CREATE TABLE "account_memberships" (
    "membership_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "scope_kind" TEXT NOT NULL,
    "organization_id" TEXT,
    "client_id" TEXT,
    "role_bundle" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "revoked_at" TEXT,

    CONSTRAINT "account_memberships_pkey" PRIMARY KEY ("membership_id"),
    CONSTRAINT "account_memberships_scope_kind_check" CHECK (
        "scope_kind" IN ('platform', 'agency', 'client')
    ),
    CONSTRAINT "account_memberships_role_bundle_check" CHECK (
        "role_bundle" IN ('platform-operator', 'agency-operator', 'client-viewer')
    ),
    CONSTRAINT "account_memberships_shape_check" CHECK (
        ("scope_kind" = 'platform' AND "organization_id" IS NULL AND "client_id" IS NULL)
        OR ("scope_kind" = 'agency' AND "organization_id" IS NOT NULL AND "client_id" IS NULL)
        OR ("scope_kind" = 'client' AND "organization_id" IS NOT NULL AND "client_id" IS NOT NULL)
    )
);

-- One membership per account per position. `COALESCE` is required because NULL
-- is not equal to NULL in a unique index, and two identical platform
-- memberships would otherwise both be storable.
CREATE UNIQUE INDEX "account_memberships_position_key" ON "account_memberships"(
    "account_id",
    "scope_kind",
    COALESCE("organization_id", ''),
    COALESCE("client_id", '')
);

CREATE INDEX "account_memberships_organization_idx" ON "account_memberships"("organization_id");

-- EnableRowLevelSecurity
--
-- FORCE, so the table owner is subject to its own policies too. Without it the
-- policy behaves differently under migration than under application traffic,
-- and a suite run as the owner would prove nothing (ADR-0033 D6).
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "account_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_memberships" FORCE ROW LEVEL SECURITY;

-- CreatePolicy
--
-- ⚠️ AN ACCOUNT IS GLOBAL; ITS VISIBILITY IS NOT. `accounts` carries no
-- `organization_id` — an identity is one identity even when it holds
-- memberships in two agencies — so the readable set is defined by the
-- memberships that reach into the current scope. A tenant therefore sees the
-- people who work on ITS clients and nobody else's, and a platform operator's
-- account, whose only membership has a NULL organization, is visible to no
-- tenant at all.
CREATE POLICY "accounts_select_in_scope" ON "accounts"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "account_memberships" AS "m"
            WHERE "m"."account_id" = "accounts"."account_id"
              AND "m"."revoked_at" IS NULL
              AND "m"."organization_id" = NULLIF(current_setting('age.organization_id', true), '')
        )
    );

CREATE POLICY "account_memberships_select_in_scope" ON "account_memberships"
    FOR SELECT
    USING (
        "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- 🛑 ADR-0079 §3 — THE ONE INSERT. `WITH CHECK` and 🚫 no `USING`, because
-- `USING` on a `FOR INSERT` policy is meaningless: there is no existing row to
-- test. What it tests is what the row MAY BECOME, and the answer is: a session
-- inside the scope the issuing transaction already set. A transaction that
-- forgot to scope itself compares against NULL and the insert is REFUSED — it
-- does not land unscoped and it does not land in someone else's tenancy.
CREATE POLICY "operator_sessions_issue_in_scope" ON "operator_sessions"
    FOR INSERT
    WITH CHECK (
        "organization_id" = NULLIF(current_setting('age.organization_id', true), '')
    );

-- Grants for the application role, applied only where that role exists — the
-- same guard the 20260811000000 migration uses, and it can hide nothing: the
-- live suite asserts the EXACT privilege set, so a skipped grant fails the
-- tests rather than passing quietly.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'age_app') THEN
        -- 🚫 SELECT AND NOTHING ELSE ON BOTH. Provisioning an account or a
        -- membership stays a human act; ADR-0079 overturned the refusal on
        -- issuing SESSIONS and 🚫 nothing else. A store the application cannot
        -- write cannot quietly grow a provisioning path.
        GRANT SELECT ON TABLE "accounts" TO age_app;
        GRANT SELECT ON TABLE "account_memberships" TO age_app;

        -- 🛑 THE INSERT ADR-0079 §3 AUTHORIZED, AND ITS EXACT WIDTH. 🚫 Still no
        -- DELETE, and the UPDATE grant is untouched and still names one column:
        -- AGE can now START a session and END one, and 🚫 it still cannot
        -- extend one, repoint one, re-tenant one or erase one.
        GRANT INSERT ON TABLE "operator_sessions" TO age_app;
    END IF;
END
$$;
