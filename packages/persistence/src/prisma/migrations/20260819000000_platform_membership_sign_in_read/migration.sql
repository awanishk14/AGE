-- ADR-0080 (Accepted 2026-08-19, OPTION A) — make a platform membership
-- readable at ONE door, and 🚫 nowhere else.
--
-- 🛑 **WHY A MIGRATION AT ALL, WHEN THE ADR SAID "A SECOND READ PATH AT ONE
-- NAMED MODULE".** Because the block is 🚫 NOT in TypeScript. `accounts` is
-- readable only through an `EXISTS` over a membership matching the current
-- scope, and `account_memberships` only where `organization_id` EQUALS it. A
-- platform membership carries `organization_id IS NULL`, and NULL is never
-- equal to anything, so 🚫 NO new reader could see it however it were written.
-- The invisibility ADR-0080 §1 describes is structural, and a structural fact
-- is undone in the schema or 🚫 not at all.
--
-- 🛑 **THE GATE IS THE GOOGLE-VERIFIED ADDRESS, AND THAT IS THE WHOLE DESIGN.**
-- The fenced reader sets `age.platform_sign_in_email` transaction-locally to the
-- address Google just proved, and the policies below expose exactly the rows
-- belonging to THAT address. ⚠️ So the reader cannot ask "who are the platform
-- operators" — it can only ask "is this one address, which I already had, one
-- of them". A defect here leaks a yes/no about an address the caller supplied,
-- 🚫 not an enumeration, and 🚫 never client data.
--
-- 🚫 **NO EXISTING POLICY IS TOUCHED, WIDENED OR REPLACED.** These are ADDITIONAL
-- `FOR SELECT` policies. PostgreSQL ORs permissive policies together, so a
-- transaction that does not set `age.platform_sign_in_email` behaves EXACTLY as
-- it did before this migration — the tenant-scoped reads are byte-for-byte
-- unchanged, and the invisibility holds for every other caller in the product.
--
-- 🚫 **NO NEW GRANT.** ADR-0080 §2: `SELECT` and nothing else, on both tables.
-- Provisioning stays a human act, and **AGE still mints nothing.**

-- CreatePolicy
--
-- ⚠️ **THE `EXISTS` IS WHAT MAKES THIS A PLATFORM DOOR RATHER THAN AN EMAIL
-- ORACLE.** Without it, this policy would answer "does an account with this
-- exact address exist in AGE" for ANY address — including every agency
-- operator's. With it, the row is visible only if the address ALSO holds a live
-- platform membership, so the question it can answer is the narrow one the
-- sign-in callback actually asks.
--
-- ⚠️ **`revoked_at IS NULL` IS HERE DELIBERATELY, AND IT COSTS SOMETHING.** A
-- platform operator whose membership was revoked reads as ABSENT rather than as
-- revoked — the same collapse the tenant-scoped policy already makes, and it is
-- stated here rather than papered over. `decideSignIn` still separates the two
-- reasons whenever the rows reach it; 🚫 the policy is NOT widened to recover a
-- distinction that only improves a log line.
CREATE POLICY "accounts_select_for_platform_sign_in" ON "accounts"
    FOR SELECT
    USING (
        "accounts"."email" = NULLIF(current_setting('age.platform_sign_in_email', true), '')
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
-- 🛑 **THIS POLICY DELIBERATELY DOES 🚫 NOT REFERENCE `accounts`, AND THAT IS A
-- CORRECTNESS REQUIREMENT RATHER THAN A STYLE CHOICE.** The `accounts` policy
-- above reads `account_memberships`; if this one read `accounts` back, the two
-- would be mutually recursive and PostgreSQL would refuse the query outright.
-- ⚠️ So the narrowing by address happens on `accounts`, ONCE, and this policy
-- narrows by SHAPE instead.
--
-- ⚠️ **WHAT THAT COSTS, STATED PLAINLY:** while the setting is present, EVERY
-- platform membership row is visible, 🚫 not only the signing-in operator's.
-- Those rows carry opaque account ids, a role bundle and NULLs — 🚫 no address,
-- 🚫 no name, 🚫 no client, 🚫 nothing about any tenant. The identities behind
-- them stay unreachable, because `accounts` still yields exactly one row. The
-- fenced reader filters to the account it resolved, so the product never uses
-- the others; this is what the DATABASE permits, and it is recorded because the
-- gap between those two is where defects live.
CREATE POLICY "account_memberships_select_for_platform_sign_in" ON "account_memberships"
    FOR SELECT
    USING (
        "account_memberships"."scope_kind" = 'platform'
        AND "account_memberships"."organization_id" IS NULL
        AND NULLIF(current_setting('age.platform_sign_in_email', true), '') IS NOT NULL
    );
