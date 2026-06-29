# Legacy Asset Catalog

**Source repository:** https://github.com/Promotix21/adaptive-growth-engine
**Catalog date:** 2026-06-29
**Purpose:** Inventory of reusable engineering assets from the legacy repository.

> This document is inventory only. No code has been migrated.
> The AGE frozen specification (architecture, Product Bible, ADRs) remains the sole source of
> truth. Assets are reused only when they fit the frozen blueprint — never to drive architectural
> decisions.

---

## Decision Categories

| Decision    | Meaning                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REIMPLEMENT | The engineering logic is architecturally correct and should be recreated in TypeScript with essentially identical behaviour. Typical: pure normalize functions, rollup math utilities, test patterns, fixtures.         |
| ADAPT       | The engineering logic is valuable but requires architectural changes before integration into AGE. Typical: connectors, crawlers, OAuth helpers, AI cost tracker, Phase 2 prompt assets.                                 |
| DISCARD     | The asset fundamentally conflicts with one or more frozen AGE architectural invariants and must not be migrated.                                                                                                        |
| DEFER       | The asset is potentially valuable but belongs to a later implementation phase. Neither rejected nor approved for immediate migration. Typical: Phase 3/4 prompts, attribution engine, Operations rollups, ad ingestion. |

---

## Catalog Summary

| #   | Asset                          | Legacy Path                                                                                                                                | Reuse Decision | AGE Target                                    |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------- |
| 1   | BaseConnector                  | `connectors/base.py`                                                                                                                       | ADAPT          | `packages/integrations/`                      |
| 2   | GA4 Connector                  | `connectors/ga4.py`                                                                                                                        | ADAPT          | `packages/integrations/providers/ga4/`        |
| 3   | GSC Connector                  | `connectors/gsc.py`                                                                                                                        | ADAPT          | `packages/integrations/providers/gsc/`        |
| 4   | GBP Connector                  | `connectors/gbp.py`                                                                                                                        | ADAPT          | `packages/integrations/providers/gbp/`        |
| 5   | PageSpeed Connector            | `connectors/pagespeed.py`                                                                                                                  | ADAPT          | `packages/integrations/providers/pagespeed/`  |
| 6   | Google Ads Connector           | `connectors/google_ads.py`                                                                                                                 | ADAPT          | `packages/integrations/providers/google-ads/` |
| 7   | Meta Ads Connector             | `connectors/meta_ads.py`                                                                                                                   | ADAPT          | `packages/integrations/providers/meta-ads/`   |
| 8   | Google OAuth helper            | `connectors/auth/google_oauth.py`                                                                                                          | ADAPT          | `packages/integrations/auth/`                 |
| 9   | GBP OAuth helper               | `connectors/auth/gbp_oauth.py`                                                                                                             | ADAPT          | `packages/integrations/auth/`                 |
| 10  | Quota manager                  | `connectors/quota.py`                                                                                                                      | ADAPT          | `packages/integrations/`                      |
| 11  | Playwright crawler             | `crawler/engine.py`                                                                                                                        | ADAPT          | `packages/integrations/crawlers/`             |
| 12  | AI cost tracker                | `ai/cost_tracker.py`                                                                                                                       | ADAPT          | `packages/shared/` (utility)                  |
| 13  | Rollup math utilities          | `rollups/util.py`                                                                                                                          | REIMPLEMENT    | `packages/shared/utils/`                      |
| 14  | Connector normalize helpers    | `connectors/ga4.py::normalize_conversions`, `connectors/google_ads.py::normalize_rows`, `connectors/meta_ads.py::extract_purchase_metrics` | REIMPLEMENT    | `packages/integrations/providers/*/`          |
| 15  | SEO Architect reasoning prompt | `.serena/skills/seo_architect.md`                                                                                                          | ADAPT          | Capability prompt layer (Phase 2)             |
| 16  | GEO/AEO Specialist prompt      | `.serena/skills/geo_specialist.md`                                                                                                         | ADAPT          | Capability prompt layer (Phase 2)             |
| 17  | Content Strategist prompt      | `.serena/skills/content_strategist.md`                                                                                                     | DEFER          | Capability prompt layer (Phase 2)             |
| 18  | CRO Specialist prompt          | `.serena/skills/cro_specialist.md`                                                                                                         | DEFER          | Capability prompt layer (Phase 2)             |
| 19  | EEAT Specialist prompt         | `.serena/skills/eeat_specialist.md`                                                                                                        | DEFER          | Capability prompt layer (Phase 2)             |
| 20  | Growth Engineer prompt         | `.serena/skills/growth_engineer.md`                                                                                                        | DEFER          | Capability prompt layer (Phase 2)             |
| 21  | Technical SEO prompt           | `.serena/skills/technical_seo.md`                                                                                                          | ADAPT          | Capability prompt layer (Phase 2)             |
| 22  | Connector unit test pattern    | `tests/test_google_ads_connector.py`, `tests/test_meta_ads_connector.py`                                                                   | REIMPLEMENT    | `packages/integrations/*/tests/`              |
| 23  | Rollup unit test pattern       | `tests/test_rollups.py`                                                                                                                    | DEFER          | Operations Capability tests (Phase 4)         |
| 24  | Ad payload ingestion helpers   | `ingest/ads.py`                                                                                                                            | DEFER          | `packages/integrations/` ingest layer         |
| 25  | Sample API fixture files       | `samples/ga4_conversions.json`, `samples/google_ads_campaign_perf.json`, `samples/meta_ads_insights.json`                                  | REIMPLEMENT    | `packages/integrations/*/fixtures/`           |

---

## Asset Details

### 1. BaseConnector

**Legacy path:** `connectors/base.py`
**Purpose:** Abstract base class for all data-source connectors. Provides: async `fetch()`/`normalize()`/`health_check()` interface, file-based cache with TTL and stale fallback, per-day quota gating, 3-attempt retry with exponential backoff and rate-limit detection.
**Dependencies:** `httpx` (indirect), `config.loader`, `config.logging` (legacy-specific).
**AGE target location:** `packages/integrations/` — base connector contract.
**Reuse decision:** ADAPT
**Required adaptation:**

- Remove dependency on legacy `config.loader` and `config.logging`; wire to AGE `@age/config` and standard logging.
- Cache mechanism uses local filesystem (`storage/cache/`). AGE will need to decide whether to retain file caching, use Redis, or remove caching entirely (Doc 14 configuration scope applies).
- Quota gating uses legacy SQLAlchemy models; replace with AGE's `@age/persistence` layer or an in-memory strategy depending on ADR.
- Language: Python. AGE is TypeScript/NestJS. The logical interface (fetch, normalize, health-check, retry, quota) is portable; the code must be re-implemented in TypeScript.
  **Architectural justification:** Doc 11 (Integration Catalog) defines Source integrations as "sensing/read-only"; the BaseConnector pattern (fetch + normalize, no side effects) is architecturally aligned. The `fetch_with_cache` retry pattern is safe because it produces data only — consistent with Doc 12 Execution boundary. Pure `normalize()` functions are unit-testable without live APIs, matching AGE's test requirements.

---

### 2. GA4 Connector

**Legacy path:** `connectors/ga4.py`
**Purpose:** Reads Google Analytics 4 reporting API (`analyticsdata v1beta`). Fetches conversions-by-source, sessions, and custom date ranges. `normalize_conversions()` is a pure, tested transform (YYYYMMDD → ISO, row flattening) separated from the API call.
**Dependencies:** `google-api-python-client`, `google-auth`, `google-auth-oauthlib`.
**AGE target location:** `packages/integrations/providers/ga4/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript using `googleapis` npm package.
- `normalize_conversions()` logic is directly portable as a pure function — high-value candidate for early extraction.
- Authentication: legacy uses file-based token storage. AGE must store credentials per the Security Model (Doc 13) — likely encrypted at-rest via `@age/persistence`, not plain JSON files.
- Scope to `Organization → Client` as defined in Doc 11 §5 (connections scoped to Client).
  **Architectural justification:** GA4 appears in Doc 11 Integration Catalog as a Source integration (sensing only). `normalize_conversions()` produces structured evidence consumable by the RIE pipeline (Doc 05 §5).

---

### 3. GSC Connector

**Legacy path:** `connectors/gsc.py`
**Purpose:** Reads Google Search Console Search Analytics API. Fetches top queries, top pages, URL inspection, and sitemaps for a verified property. Handles domain-property vs URL-prefix property resolution automatically.
**Dependencies:** `google-api-python-client`, `google-auth-oauthlib`.
**AGE target location:** `packages/integrations/providers/gsc/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript (`googleapis` npm).
- Property-resolution logic (domain property preferred over URL-prefix) is a subtle correctness detail worth preserving exactly.
- Authentication: same as GA4 — replace file-based token storage with `@age/persistence`-backed credential store.
- Scoped to Client per Doc 11 §5.
  **Architectural justification:** GSC is a Source integration (Doc 11); keyword/query/ranking data feeds the RIE sensing layer (Doc 05 §5) for Market Discovery Capability inputs.

---

### 4. GBP Connector

**Legacy path:** `connectors/gbp.py`
**Purpose:** Reads Google Business Profile API (locations, reviews, insights, posts) across four separate GBP API base URLs. Uses separate OAuth scope (`business.manage`) distinct from GA4/GSC. Handles 401 token refresh transparently.
**Dependencies:** `httpx`, `connectors/auth/gbp_oauth.py`.
**AGE target location:** `packages/integrations/providers/gbp/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript using `axios`/`fetch`.
- The multi-URL GBP API surface (account management, business info, performance, mybusiness v4) and the separate OAuth scope are implementation-accurate details worth preserving.
- Token refresh logic (401 → refresh once → retry) should be extracted into the shared auth layer.
- Scoped to Client per Doc 11 §5.
  **Architectural justification:** GBP is a Source integration (Doc 11); local search presence data feeds Market Discovery Capability (Doc 15, CAPABILITY_ARCHITECTURE §7).

---

### 5. PageSpeed Connector

**Legacy path:** `connectors/pagespeed.py`
**Purpose:** Calls Google PageSpeed Insights API v5 (no OAuth — API key only). Returns Core Web Vitals (LCP, FID, CLS, TTFB, FCP, SI, TTI, TBT), overall performance score, and opportunity list sorted by estimated savings.
**Dependencies:** `httpx`.
**AGE target location:** `packages/integrations/providers/pagespeed/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript (`axios`/`fetch`). Logic is straightforward — the normalize function extracts known metric keys from Lighthouse audit results.
- API key management: move from config flat file to AGE's Configuration Model (Doc 14) and Secret references (Doc 14 §8).
- Metric key list (`largest-contentful-paint`, `max-potential-fid`, etc.) is directly portable.
  **Architectural justification:** PageSpeed is a Source integration (Doc 11); Core Web Vitals are technical SEO signals feeding the Market Discovery Capability RIE pipeline.

---

### 6. Google Ads Connector

**Legacy path:** `connectors/google_ads.py`
**Purpose:** Fetches campaign-level daily performance via GAQL (impressions, clicks, cost\_micros, conversions, revenue). `normalize_rows()` is a **pure function** separated from the API call — converts proto rows to a warehouse-shaped dict (account + campaigns\[] + performance\[]). Handles micros-to-decimal conversion.
**Dependencies:** `google-ads>=24.0` (Python client library).
**AGE target location:** `packages/integrations/providers/google-ads/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript. The `google-ads-api` npm package covers GAQL queries.
- `normalize_rows()` pure function is directly portable — extract first.
- `_micros_to_decimal()` is a one-liner but correctness-critical; port exactly.
- Credentials model (developer token + separate refresh token + login\_customer\_id) is accurately captured and must be preserved in AGE credential storage.
  **Architectural justification:** Google Ads is a Source/Hybrid integration (Doc 11). Campaign performance data feeds the Growth Capability and Revenue Capability reporting pipelines (Phase 3/4).

---

### 7. Meta Ads Connector

**Legacy path:** `connectors/meta_ads.py`
**Purpose:** Fetches Meta Marketing API campaign insights via direct `httpx` calls (no facebook-business SDK). Emits the same normalized warehouse shape as the Google Ads connector. `extract_purchase_metrics()` handles Meta's `actions`/`action_values` arrays with a priority-ordered dedup strategy.
**Dependencies:** `httpx`.
**AGE target location:** `packages/integrations/providers/meta-ads/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript (`axios`/`fetch`).
- `_select_by_priority()` and `extract_purchase_metrics()` pure functions are directly portable — the purchase-action priority list (`omni_purchase → purchase → offsite_conversion…`) is empirically derived and worth preserving exactly.
- Long-lived access token management: replace with AGE `@age/persistence` credential storage.
- `api_version` should be configuration-driven per AGE Doc 14 (currently hardcoded to `v21.0`).
  **Architectural justification:** Meta Ads is a Source/Hybrid integration (Doc 11). Paid media performance data feeds the Growth Capability (Phase 3).

---

### 8. Google OAuth Helper

**Legacy path:** `connectors/auth/google_oauth.py`
**Purpose:** Manages OAuth2 token lifecycle for GA4 and GSC (scopes: `analytics.readonly`, `analytics.edit`, `webmasters.readonly`). Handles initial browser-based consent flow, token persistence to disk, and silent refresh.
**Dependencies:** `google-auth`, `google-auth-oauthlib`, `google-api-python-client`.
**AGE target location:** `packages/integrations/auth/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript using `google-auth-library` npm package.
- **File-based token storage must be replaced** with encrypted credential storage via `@age/persistence` + Doc 13 Security Model (§6: Credential Storage). Token files on disk violate the security boundary.
- Browser consent flow is for CLI use only; AGE will need a web-based OAuth callback. Architecture of the callback endpoint is an implementation detail for Phase 2.
- Scope list is directly reusable.
  **Architectural justification:** Auth helpers are shared infrastructure for Source integrations (Doc 11). Credential handling must conform to Doc 13 §6.

---

### 9. GBP OAuth Helper

**Legacy path:** `connectors/auth/gbp_oauth.py`
**Purpose:** Manages OAuth2 token lifecycle specifically for GBP's `business.manage` scope — separate token file and refresh logic from the GA4/GSC flow.
**Dependencies:** `httpx`, `google-auth`.
**AGE target location:** `packages/integrations/auth/`
**Reuse decision:** ADAPT
**Required adaptation:** Same as Asset 8. Replace file storage with `@age/persistence`. The separation of GBP auth from GA4/GSC auth is architecturally correct (different scopes, different token lifecycle) and must be preserved.
**Architectural justification:** Same as Asset 8.

---

### 10. Quota Manager

**Legacy path:** `connectors/quota.py`
**Purpose:** Tracks per-service API call counts against daily limits using a database table. Provides `can_call()` (check before request) and `record_call()` (increment after). Fails open on DB error.
**Dependencies:** Legacy SQLAlchemy models (`APIQuota` table).
**AGE target location:** `packages/integrations/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript.
- Replace legacy SQLAlchemy `APIQuota` model with an AGE persistence entity via `@age/persistence`.
- Default limits per service (GA4: 5000/day, GSC: 15000/day, etc.) are accurate to the APIs and worth preserving.
- Quota scope (currently global per service) must be aligned to AGE's `Organization → Client` hierarchy per Doc 02 §3 — whether quota is enforced at platform level or per-client is an implementation decision for Phase 2.
  **Architectural justification:** Quota management is infrastructure for Source integrations (Doc 11 §4: "connections are managed resources"). Does not perform side effects; classifies as a producer/guard pattern consistent with Doc 12.

---

### 11. Playwright Crawler

**Legacy path:** `crawler/engine.py`
**Purpose:** Playwright-based async website crawler. Extracts per-page SEO signals: status code, title, meta description, H1, heading structure, schema types, canonical, robots directives, word count, internal/external links, broken links, image alt coverage, page load time, OG tags, analytics presence, and content hash. Respects `robots.txt`. Configurable max pages/depth.
**Dependencies:** `playwright>=1.40` (Python). The `PageData` dataclass enumerates all extracted fields.
**AGE target location:** `packages/integrations/crawlers/`
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript using `playwright` npm package (same Chromium engine — API is near-identical).
- `PageData` dataclass maps directly to a TypeScript interface; all fields are portable.
- `RobotsChecker` sub-class (not shown but referenced) must be ported with it.
- Replace legacy config (`self.crawler_config`) with AGE `@age/config`.
- Output is pure data (no side effects) — conforms to Doc 12 Execution boundary.
- Parallelism model (currently single-threaded async queue) may be upgraded; that is an implementation decision.
  **Architectural justification:** Web crawling is a Source integration (Doc 11 §2, "sensing/read-only"). Crawler output feeds the Market Discovery Capability RIE pipeline as raw evidence signals. Pure producer — consistent with Doc 09 §5 and Doc 12.

---

### 12. AI Cost Tracker

**Legacy path:** `ai/cost_tracker.py`
**Purpose:** Tracks AI API usage (tokens in/out, latency, model, operation) and enforces configurable daily/monthly/per-scan budget limits. Per-model cost table (Gemini Flash, Sonnet, Haiku). Stores usage log to database.
**Dependencies:** Legacy SQLAlchemy `AIUsageLog` model, `database.connection`.
**AGE target location:** `packages/shared/` (utility, not capability-specific)
**Reuse decision:** ADAPT
**Required adaptation:**

- Re-implement in TypeScript.
- Replace legacy DB model with `@age/persistence`.
- `MODEL_COSTS` table is accurate but should be configuration-driven (Doc 14) rather than hardcoded — model pricing changes frequently.
- Budget limits should be scoped to Organization level per Doc 02 §4 (agency-owned resources) and configurable per Doc 14.
- `estimate_cost()` pure function is directly portable.
  **Architectural justification:** Cost tracking is an operational observability concern. AGE's Configuration Model (Doc 14) and AI workforce governance (Doc 04 §7) both require budget controls to be explicit and configurable. This does not belong to any single capability — it is a shared platform utility.

---

### 13. Rollup Math Utilities

**Legacy path:** `rollups/util.py`
**Purpose:** Pure utility functions: `to_float()` (Decimal/int/None → float), `safe_div()` (zero-safe division), `coerce_date()` (date/datetime/string → date), `resolve_range()` (default date window), `derived_metrics()` (CTR, CPC, ROAS, CVR from ad aggregates). All stateless, no I/O.
**Dependencies:** Python stdlib only (`datetime`, `decimal`).
**AGE target location:** `packages/shared/utils/`
**Reuse decision:** REIMPLEMENT
**Required adaptation:** Rewrite in TypeScript (trivial — all functions are one-liners or small). Logic is directly portable. No architectural changes needed.
**Architectural justification:** Pure math utilities with no side effects. `derived_metrics()` computes standard advertising KPIs (CTR, CPC, ROAS, CVR) referenced in Doc 10 (Reporting) and the Growth/Revenue Capability definitions.

---

### 14. Connector Normalize Pure Functions

**Legacy path:** `connectors/ga4.py::normalize_conversions`, `connectors/google_ads.py::normalize_rows`, `connectors/meta_ads.py::extract_purchase_metrics` + `_select_by_priority`
**Purpose:** Module-level (not class methods) pure transform functions, intentionally separated from API calls to be unit-testable without live credentials. Each converts raw API response shapes into structured evidence objects.
**Dependencies:** None (stdlib only).
**AGE target location:** Alongside their respective provider packages in `packages/integrations/providers/*/`.
**Reuse decision:** REIMPLEMENT
**Required adaptation:** Port to TypeScript. Logic is directly portable; the separation pattern (pure normalize function + API class) is the correct pattern to preserve in AGE.
**Architectural justification:** Pure transforms produce structured data from raw API responses — this is the RIE "sensing" step (Doc 05 §5). Keeping them as pure functions (no DB, no network) supports the test-first SFD requirement (`docs/engineering/SPECIFICATION_FIRST_DEVELOPMENT.md`).

---

### 15. SEO Architect Reasoning Prompt

**Legacy path:** `.serena/skills/seo_architect.md`
**Purpose:** Structured reasoning prompt for SEO analysis: prioritization order (indexation → crawlability → keyword gaps → internal linking → schema), reasoning pattern (symptom → data → root cause → business impact → fix → validation), output requirements (root-cause mandatory, revenue impact estimated, validation metric required).
**AGE target location:** Capability prompt layer — Market Discovery Capability (Phase 2).
**Reuse decision:** ADAPT
**Required adaptation:**

- Strip legacy tool/CLI references. Reformulate as an AGE AI agent instruction aligned to Doc 01 AI Workforce persona contracts and Doc 04 §7 (pure producer, evidence-backed outputs).
- Output format must produce structured objects consumable by the RIE/SIE pipeline (Doc 05), not free-text reports.
- "Reasoning Pattern" (5-step) is a high-quality distillation worth preserving as the SEO Agent's analytical framework.
  **Architectural justification:** Provides proven domain reasoning for the SEO Agent (Doc 01) operating within the Market Discovery Capability. Adapted prompt content does not affect the frozen architecture — it is capability-layer configuration (Doc 14).

---

### 16. GEO/AEO Specialist Prompt

**Legacy path:** `.serena/skills/geo_specialist.md`
**Purpose:** Structured reasoning for Generative Engine Optimization (GEO/AEO): citability, direct-answer capability, structured attribution, entity density. Audit checklist: statement verification, quotability, technical readability, relationship mapping.
**AGE target location:** Capability prompt layer — AEO/GEO Agent (Doc 01, Market Discovery Capability, Phase 2).
**Reuse decision:** ADAPT
**Required adaptation:** Same as Asset 15. The GEO/AEO distinction (AI-first search vs traditional SERP) maps directly to the `AEO/GEO Agent` persona in Doc 01. Adapt output format to produce structured evidence objects.
**Architectural justification:** AEO/GEO is explicitly named in the Market Discovery Capability scope (CAPABILITY_ARCHITECTURE §7) and as an AI Agent in Doc 01.

---

### 17. Content Strategist Prompt

**Legacy path:** `.serena/skills/content_strategist.md`
**Purpose:** Structured reasoning for content analysis: thin content, missing clusters, outdated content, topical authority, cannibalization. Content brief template with required fields (target keyword, search intent, structure, entities, internal links, schema, word count, competitor reference).
**AGE target location:** Capability prompt layer — Content Agent (Doc 01, Authority Capability, Phase 3).
**Reuse decision:** DEFER
**Required adaptation:** Adapt for the Content Agent persona (Doc 01). The content brief template is a high-value structured output format. Reformulate to produce outputs that feed into the SIE `DecisionPackage` rather than free-text briefs.
**Architectural justification:** Content strategy maps to the Authority Capability (CAPABILITY_ARCHITECTURE §7: "content, PR, backlinks, reviews, thought leadership").

---

### 18. CRO Specialist Prompt

**Legacy path:** `.serena/skills/cro_specialist.md`
**Purpose:** Could not fully inspect; file exists (confirmed in tree). Expected to contain structured reasoning for conversion rate optimization.
**AGE target location:** Capability prompt layer — Growth Capability (Phase 3).
**Reuse decision:** DEFER
**Required adaptation:** Inspect before Phase 3 begins. Adapt output format to structured evidence objects.
**Architectural justification:** CRO is part of the Growth Capability (CAPABILITY_ARCHITECTURE §7: "paid media, CRO, funnels").

---

### 19. EEAT Specialist Prompt

**Legacy path:** `.serena/skills/eeat_specialist.md`
**Purpose:** Could not fully inspect; file exists (confirmed in tree). Expected to contain structured reasoning for Experience, Expertise, Authoritativeness, Trustworthiness signals.
**AGE target location:** Capability prompt layer — Authority Capability (Phase 3).
**Reuse decision:** DEFER
**Required adaptation:** Inspect before Phase 3 begins. EEAT overlaps with Content and SEO agent domains.
**Architectural justification:** EEAT signals feed both Authority Capability (content depth/trust) and Market Discovery (ranking signals).

---

### 20. Growth Engineer Prompt

**Legacy path:** `.serena/skills/growth_engineer.md`
**Purpose:** Could not fully inspect; file exists (confirmed in tree). Expected to cover cross-channel growth engineering reasoning.
**AGE target location:** Capability prompt layer — Growth Capability (Phase 3).
**Reuse decision:** DEFER
**Required adaptation:** Inspect before Phase 3 begins.
**Architectural justification:** Growth engineering maps to the Growth Capability (CAPABILITY_ARCHITECTURE §7).

---

### 21. Technical SEO Prompt

**Legacy path:** `.serena/skills/technical_seo.md`
**Purpose:** Could not fully inspect; file exists (confirmed in tree). Expected to cover Core Web Vitals, crawlability, indexation, structured data reasoning.
**AGE target location:** Capability prompt layer — Market Discovery Capability (Phase 2); overlaps with SEO Agent (Doc 01).
**Reuse decision:** ADAPT
**Required adaptation:** Inspect alongside Asset 15 (SEO Architect) before Phase 2 begins; merge or distinguish based on content.
**Architectural justification:** Technical SEO signals feed Market Discovery Capability via the crawler pipeline (Assets 11, 14).

---

### 22. Connector Unit Test Pattern

**Legacy path:** `tests/test_google_ads_connector.py`, `tests/test_meta_ads_connector.py`
**Purpose:** Tests connector `normalize()` pure functions against sample JSON fixtures in `samples/`. Pattern: load fixture → call pure function → assert on output shape. No live API calls, no DB, no authentication required.
**Dependencies:** `pytest`, `pytest-asyncio`. Sample fixtures from `samples/`.
**AGE target location:** `packages/integrations/providers/*/tests/` (alongside each provider)
**Reuse decision:** REIMPLEMENT
**Required adaptation:** Port test assertions to TypeScript (Jest or Vitest). The pattern — fixture JSON + pure function + shape assertions — is the correct, fully portable test strategy for connector normalization logic.
**Architectural justification:** SFD requires tests alongside implementation (`docs/engineering/SPECIFICATION_FIRST_DEVELOPMENT.md`). The pure-normalize + fixture pattern is directly compatible with AGE's TypeScript test infrastructure and avoids live API dependency in the test suite.

---

### 23. Rollup Unit Test Pattern

**Legacy path:** `tests/test_rollups.py`
**Purpose:** Tests reporting/rollup math using a seeded rolling-back PostgreSQL session. Verifies spend, ROAS, revenue, and attribution rollups against known inserted data. Uses real DB (not mocks) to test the ORM layer accurately.
**Dependencies:** `pytest`, `sqlalchemy`, PostgreSQL (test DB), `dotenv`.
**AGE target location:** Operations Capability tests (Phase 4), or `packages/integrations/` for ad-aggregation math.
**Reuse decision:** DEFER
**Required adaptation:** Port to TypeScript + Prisma/TypeORM test patterns. The transactional-rollback pattern (insert → test → rollback) is portable and valuable. Replace SQLAlchemy session with AGE's `@age/persistence` test utilities.
**Architectural justification:** Reporting accuracy is a first-class concern (Doc 10 §2: "traceable, accurate"). Integration tests against a real DB (vs mocked) provide higher confidence for the reporting layer.

---

### 24. Ad Payload Ingestion Helpers

**Legacy path:** `ingest/ads.py`
**Purpose:** Pure-ish mapper functions (`ingest_ad_payload`) that convert normalized connector output into database upsert calls. Handles type coercion (`_to_decimal`, `_to_date`), Decimal precision for cost fields, and null handling.
**Dependencies:** Legacy SQLAlchemy `crud` layer.
**AGE target location:** `packages/integrations/` — ingest/persistence bridge for ad data.
**Reuse decision:** DEFER
**Required adaptation:**

- Re-implement in TypeScript.
- Replace legacy CRUD functions with `@age/persistence` entities.
- The `_to_decimal()` and `_to_date()` coercion helpers (cost via `Decimal(str(value))` to avoid float artifacts) are correctness-critical details worth preserving exactly.
- Ingestion scope must respect `Organization → Client` hierarchy (Doc 02 §3).
  **Architectural justification:** Data ingestion from integrations is a Source integration concern (Doc 11). The pure coercion helpers are safe (no side effects beyond the DB write, which goes through `@age/persistence`).

---

### 25. Sample API Fixture Files

**Legacy path:** `samples/ga4_conversions.json`, `samples/google_ads_campaign_perf.json`, `samples/meta_ads_insights.json`
**Purpose:** Real-shape (anonymized) API response fixtures used as test inputs for connector normalize functions. Validated against actual API responses.
**AGE target location:** `packages/integrations/providers/*/fixtures/`
**Reuse decision:** REIMPLEMENT
**Required adaptation:** Copy directly into the corresponding AGE provider package fixture directories. Verify field shapes still match current API versions before adoption (API schemas evolve — GA4 Data API, Google Ads API, Meta Marketing API all have versioned responses).
**Architectural justification:** Accurate test fixtures are foundational to the pure-normalize test pattern (Asset 22). They require no adaptation of AGE architecture.

---

## Assets Explicitly Not Cataloged

The following legacy components were reviewed and intentionally excluded:

| Component                          | Legacy Path                                                | Reason excluded                                                                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Orchestrator                    | `ai/orchestrator.py`                                       | Encodes autonomous pipeline (fetch → analyze → fix → apply). Contradicts Doc 12 Execution boundary — AGE does not permit autonomous side-effect pipelines. Architecture incompatible.                                       |
| ClaudeArchitect / GeminiAnalyst    | `ai/claude_architect.py`, `ai/gemini_analyst.py`           | Encode legacy product behavior (fix generation, content briefs via direct DB query). The AGE AI Workforce uses a structured capability + pure-producer model (Doc 04). These would need complete redesign — not adaptation. |
| Agent executor / lifecycle / loop  | `agent/executor.py`, `agent/lifecycle.py`, `agent/loop.py` | Autonomous agent loop with executor side effects. Directly contradicts Doc 12 §5 (no autonomous execution in current scope) and Doc 09 §7. Discard.                                                                         |
| Agent memory                       | `agent/memory.py`                                          | Legacy cross-site memory model. AGE uses the BKG (per-Client, scoped) as the knowledge model (Doc 05 §3, ADR-0003). Incompatible ownership model.                                                                           |
| Database models / migrations       | `database/models.py`, `database/migrations/`               | Legacy SQLAlchemy schema with AGE-incompatible domain model (no Organization/Client/Project hierarchy, autonomous execution columns). Not reusable.                                                                         |
| Attribution engine                 | `attribution/engine.py`, `attribution/persist.py`          | Custom multi-touch attribution model built on legacy schema. May be revisted for Revenue Capability (Phase 4) only — requires full architectural review at that point. Not cataloged now.                                   |
| Desktop Electron app               | `desktop/`                                                 | Separate Electron+React app, TypeScript, but encodes legacy navigation/UI model. AGE has its own UI architecture (Doc 07). Discard entirely.                                                                                |
| FastAPI sidecar / UI               | `ui/api.py`, `ui/app.py`, `ui/launcher.py`                 | Legacy Python FastAPI service for CLI-triggered analysis. AGE is a NestJS API + React web app. Architecture incompatible.                                                                                                   |
| CLI commands                       | `cli/commands/`                                            | Entire CLI layer assumes legacy workflow model (autonomous analyze → apply). AGE does not have a CLI product surface. Discard.                                                                                              |
| Config loader                      | `config/loader.py`                                         | Legacy Python dataclass config system. AGE uses `@age/config` TypeScript package.                                                                                                                                           |
| Report generators / client reports | `reports/`, `scripts/`                                     | Client-specific deliverables and report scripts for prior engagements. Not engineering assets — not cataloged.                                                                                                              |
| Ingest / attribution ingest        | `ingest/attribution.py`                                    | Deep dependency on legacy attribution schema. See attribution engine above.                                                                                                                                                 |

---

## Migration Readiness

**Overall assessment: Partially ready — TypeScript re-implementation required before any migration.**

The legacy codebase is Python (Python 3.11+, SQLAlchemy 2.0, asyncio). AGE is TypeScript/NestJS. No Python code can be directly copied into AGE packages. Every ADAPT decision requires re-implementation in TypeScript.

**What is ready to begin in Phase 2 (Intelligence Capability):**

- Pure normalize functions (Assets 14) — highest priority; port first and build tests against fixtures (Asset 25) immediately.
- Rollup math utilities (Asset 13) — trivial TypeScript port; unblock reporting from day one.
- GA4, GSC connectors (Assets 2, 3) — the Intelligence Capability requires access to GA4/GSC data. Begin with the pure normalize functions, then build the TypeScript connector classes.
- Connector unit test pattern (Asset 22) — adopt pattern immediately for all new connectors.
- BaseConnector contract (Asset 1) — define the TypeScript interface first; implement concrete connectors against it.

**What should wait for later phases:**

- GBP, PageSpeed, Google Ads, Meta Ads connectors (Assets 4, 5, 6, 7) — Phase 2 or 3 depending on capability roadmap.
- AI cost tracker (Asset 12) — Phase 2 (needed once AI agent calls begin).
- Prompt/skill assets (Assets 15–21) — Phase 2 (Market Discovery) and Phase 3 (Growth/Authority). Inspect remaining `.serena/skills/` files before those phases begin.
- Rollup test pattern (Asset 23) — Phase 4 (Operations Capability).
- Ad ingestion helpers (Asset 24) — Phase 3 (Growth Capability, when ad data pipeline is built).

**Pre-migration prerequisite:** ADR-0009 (Client Aggregate) must be completed before any connector or ingestion code is written, since every integration is scoped to `Organization → Client` (Doc 11 §5) and the `Client` implementation model must be resolved first.

---

## Migration Status

> Tracks the implementation progress of each cataloged asset.
> Updated as Phase 2 implementation proceeds.

**Status values:** Not Started · In Progress · Completed · Deferred · Discarded

| #   | Asset                              | Decision    | Status      |
| --- | ---------------------------------- | ----------- | ----------- |
| 1   | BaseConnector                      | ADAPT       | Not Started |
| 2   | GA4 Connector                      | ADAPT       | Not Started |
| 3   | GSC Connector                      | ADAPT       | Not Started |
| 4   | GBP Connector                      | ADAPT       | Not Started |
| 5   | PageSpeed Connector                | ADAPT       | Not Started |
| 6   | Google Ads Connector               | ADAPT       | Not Started |
| 7   | Meta Ads Connector                 | ADAPT       | Not Started |
| 8   | Google OAuth Helper                | ADAPT       | Not Started |
| 9   | GBP OAuth Helper                   | ADAPT       | Not Started |
| 10  | Quota Manager                      | ADAPT       | Not Started |
| 11  | Playwright Crawler                 | ADAPT       | Not Started |
| 12  | AI Cost Tracker                    | ADAPT       | Not Started |
| 13  | Rollup Math Utilities              | REIMPLEMENT | Not Started |
| 14  | Connector Normalize Pure Functions | REIMPLEMENT | Not Started |
| 15  | SEO Architect Reasoning Prompt     | ADAPT       | Not Started |
| 16  | GEO/AEO Specialist Prompt          | ADAPT       | Not Started |
| 17  | Content Strategist Prompt          | DEFER       | Deferred    |
| 18  | CRO Specialist Prompt              | DEFER       | Deferred    |
| 19  | EEAT Specialist Prompt             | DEFER       | Deferred    |
| 20  | Growth Engineer Prompt             | DEFER       | Deferred    |
| 21  | Technical SEO Prompt               | ADAPT       | Not Started |
| 22  | Connector Unit Test Pattern        | REIMPLEMENT | Not Started |
| 23  | Rollup Unit Test Pattern           | DEFER       | Deferred    |
| 24  | Ad Payload Ingestion Helpers       | DEFER       | Deferred    |
| 25  | Sample API Fixture Files           | REIMPLEMENT | Not Started |

---

# Legacy Migration Principles

> Permanent engineering policy for using the legacy repository during AGE implementation.
> These principles apply to every phase and every contributor.

---

## Engineering Knowledge Over Code

The legacy repository is primarily a source of engineering knowledge.

We migrate ideas, algorithms, patterns, and proven implementation approaches — not source files.

---

## Architecture Is Never Imported

The legacy repository must never influence:

- Architecture
- Capability boundaries
- Module organization
- Product workflows
- Navigation
- Ownership models

Those are defined exclusively by the frozen AGE specification.

---

## Reimplementation Preferred

Even when an asset is marked **REIMPLEMENT**, developers should recreate the behavior using AGE architecture and TypeScript.

Direct file copying should be avoided except for non-code artifacts such as fixtures or reference prompt text where appropriate.

---

## Every Migration Requires Justification

Every migrated asset must answer:

- Why is it being migrated?
- Which AGE capability requires it?
- Which architectural boundary does it belong to?
- Does it preserve the frozen architecture?

If these questions cannot be answered, the asset should not be migrated.

---

## Migration Is Capability-Driven

Assets are migrated only when required by an implementation EPIC.

No asset should be migrated simply because it already exists.

---

## AGE Always Wins

If the legacy repository and the frozen AGE specification differ:

**The AGE specification is always correct.**

Implementation must adapt the legacy asset — not the specification.
