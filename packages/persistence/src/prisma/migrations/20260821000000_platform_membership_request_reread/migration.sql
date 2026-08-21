-- ADR-0089 (Accepted 2026-08-21, OPTION D) — let a REQUEST re-read the platform
-- membership it is standing on, keyed by the account id the session proved.
--
-- 🛑 **WHY THIS EXISTS.** ADR-0079 §2 property 2 says the scope is read from the
-- database on EVERY request, never from a token claim — so a revoked operator
-- loses their reach on the next request rather than at token expiry. That was
-- true on the tenant arm and FALSE on the platform arm, because the only fenced
-- platform read is keyed by the Google-verified address and a request does not
-- have one. ⚠️ The window was up to eight hours, on the WIDEST scope AGE has.
--
-- 🛑 **A SECOND KEY, 🚫 NOT A WIDER POLICY.** The ADR-0080 policies below are
-- untouched: these are ADDITIONAL `FOR SELECT` policies keyed on a DIFFERENT
-- transaction-local setting. PostgreSQL ORs permissive policies together, so a
-- transaction that sets neither setting behaves EXACTLY as it did before this
-- migration, and every tenant-scoped read is byte-for-byte unchanged.
--
-- 🚫 **NO NEW GRANT, AND 🚫 NOTHING BUT SELECT.** `age_app` gains nothing here.
-- 🚫 No INSERT policy, 🚫 no FORCE RLS change. Provisioning stays a human act and
-- **AGE STILL MINTS NOTHING** — this reads rows a person created.
--
-- ⚠️ **WHY THE ACCOUNT ID IS A SAFE KEY AND THE ORGANIZATION WOULD NOT BE.** The
-- account id is opaque, it is already proved by the session row the request is
-- carrying, and it names 🚫 no tenant. Keying this on an organization instead —
-- the "obvious" fix — is the ADR-0082 D4 substitution: a platform principal has
-- NO organization, and supplying one would read an agency's people and re-decide
-- the operator as a member of a tenant they are not in.

-- CreatePolicy
--
-- ⚠️ **THE `EXISTS` IS WHAT MAKES THIS A DOOR RATHER THAN AN ACCOUNT ORACLE**,
-- exactly as in `20260819000000_platform_membership_sign_in_read`. Without it,
-- this would answer "does this account id exist in AGE" for ANY id, including
-- every agency operator's. With it, the row is visible only if that account ALSO
-- holds a LIVE platform membership — the narrow question a request actually asks.
--
-- ⚠️ **`revoked_at IS NULL` IS THE POINT HERE, 🚫 NOT AN INCIDENTAL CLAUSE.** A
-- platform operator whose membership was revoked reads as ABSENT, so the request
-- path refuses them on the very next request. 🛑 The cost is the same collapse
-- its address-keyed sibling already makes and it is stated rather than papered
-- over: they are refused as UNKNOWN rather than as REVOKED, because the database
-- declines to say which. 🚫 The policy is NOT widened to recover a distinction
-- that only improves a log line, and the refusal a person sees is identical.
CREATE POLICY "accounts_select_for_platform_account_reread" ON "accounts"
    FOR SELECT
    USING (
        "accounts"."account_id" = NULLIF(current_setting('age.platform_sign_in_account', true), '')
        AND EXISTS (
            SELECT 1
            FROM "account_memberships" AS "m"
            WHERE "m"."account_id" = "accounts"."account_id"
              AND "m"."revoked_at" IS NULL
              AND "m"."scope_kind" = 'platform'
              AND "m"."organization_id" IS NULL
        )
    );

-- CreatePolicy
--
-- 🛑 **THIS POLICY DELIBERATELY DOES 🚫 NOT REFERENCE `accounts`**, for the same
-- correctness reason its sibling gives: the `accounts` policy above reads
-- `account_memberships`, and if this one read `accounts` back the two would be
-- mutually recursive and PostgreSQL would refuse the query outright. ⚠️ So the
-- narrowing by identity happens on `accounts`, ONCE, and this policy narrows by
-- SHAPE instead.
--
-- ⚠️ **WHAT THAT COSTS, STATED PLAINLY AND UNCHANGED FROM ADR-0080:** while the
-- setting is present, EVERY live platform membership row is visible, 🚫 not only
-- the requesting operator's. Those rows carry opaque account ids, a role bundle
-- and NULLs — 🚫 no address, 🚫 no name, 🚫 no client, 🚫 nothing about any
-- tenant. The identities behind them stay unreachable because `accounts` still
-- yields exactly one row, and the fenced reader filters to the account it
-- resolved. This is what the DATABASE permits; the gap between that and what the
-- product uses is where defects live, so it is recorded.
CREATE POLICY "account_memberships_select_for_platform_account_reread" ON "account_memberships"
    FOR SELECT
    USING (
        "account_memberships"."scope_kind" = 'platform'
        AND "account_memberships"."organization_id" IS NULL
        AND "account_memberships"."revoked_at" IS NULL
        AND NULLIF(current_setting('age.platform_sign_in_account', true), '') IS NOT NULL
    );
