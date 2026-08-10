/**
 * `@age/entitled-read` — ADR-0068 §0.1b, the entitlement question's first real
 * caller, on a READ path.
 *
 * 🛑 **THIS PACKAGE DISCHARGES ONE THING AND CLAIMS NOTHING ELSE.** ADR-0066 D7
 * is unchanged for every other surface: no inbound endpoint may accept, persist,
 * transform or queue tenant-scoped data. This accepts nothing inbound — it is a
 * pure function a caller invokes with a session it already holds.
 *
 * 🚫 **NO ROWS, NO MINTING, NO SECOND HUMAN.** The session store rows (ADR-0068
 * §0.1b: Postgres model + migration + RLS) are authorized and 🚫 not built here;
 * token verification is authorized and 🚫 not built here; and 🛑 **verification
 * is not issuance** — 🚫 no login route, screen, cookie, provisioning surface or
 * operator switcher exists, in this package or anywhere (§0.1c).
 *
 * 🚫 **NO BUSINESS-OWNER ANYTHING** (ADR-0066 §0.6). "Future compatible" is the
 * named failure mode.
 */

export {
  EntitlementRefusedError,
  readWithinEntitlement,
  type EntitledReadInput,
} from './entitled-organization-read';
