import { describe, expect, it } from 'vitest';

import { assertSafeClientIdForFileName } from '@age/studio-shell';

import { mintClientId } from './operator-environment';

/**
 * ADR-0090 §5 GUARD 3 — the minted id passes the filename check, and the check
 * actually RUNS on it.
 *
 * 🛑 **THIS FILE IMPORTS THE REAL EFFECT MODULE, DELIBERATELY, AND MUST NOT
 * MOCK IT.** The first draft of this guard lived alongside the action tests,
 * which stub `./operator-environment` — so it asserted the STUB's id shape and
 * would have passed no matter what shipped. ⚠️ A guard aimed at an
 * implementation it cannot reach is a guard that has only ever passed.
 *
 * ⚠️ `mintClientId` reads nothing from the environment, so importing this
 * module for it is safe; 🚫 do not add a case here that needs the environment.
 */
describe('ADR-0090 D5 — the shape of a minted client id', () => {
  it('mints an id the shared filename check accepts', () => {
    // Repeated because the mint is random: one draw proves one draw.
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const minted = mintClientId();

      expect(minted).toMatch(/^cli_[0-9a-f]{32}$/);
      // 🛑 Asserted through the SHARED check, 🚫 not by re-stating its rule
      // here: a guard holding its own copy of a rule stops tracking that rule.
      expect(() => assertSafeClientIdForFileName(minted)).not.toThrow();
    }
  });

  it('mints a different id every time', () => {
    const seen = new Set(Array.from({ length: 256 }, () => mintClientId()));
    expect(seen.size).toBe(256);
  });
});
