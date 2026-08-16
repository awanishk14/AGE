import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 🛑 **A SCREEN CLAIMING A BLOCKER THE ARCHITECTURE HAS SINCE REMOVED IS AS
 * DISHONEST AS ONE CLAIMING A CAPABILITY THAT DOES NOT EXIST.**
 *
 * ⚠️ MEASURED on the deployed console, signed in, over real persisted data:
 * four panels told the operator that AGE "has no sign-in yet" as the reason
 * attribution could not be taken from their identity. They read it in a session
 * they had just signed into. The sentence had been true when it was written and
 * became false in ADR-0074 slice 2.
 *
 * 🚫 **THE FIX IS 🚫 NOT "ATTRIBUTE FROM THE SESSION".** `OperatorPrincipal` is
 * never defaulted, generated or inferred (ADR-0053 D4): who signed in and who is
 * accountable for an attribution are two different facts, and the field stays
 * typed. Only the *reason* given for it was wrong.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Claims that were true before slice 2 and are false in a signed-in console. */
const REFUTED_BY_THE_DEPLOYED_PRODUCT: readonly string[] = [
  'has no sign-in',
  'no sign-in yet',
  'there is no session',
  'no authenticated operator',
];

const sources = readdirSync(__dirname)
  .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
  .map((name) => ({ name, text: readFileSync(join(__dirname, name), 'utf8') }));

describe('no screen states a blocker the deployed console has removed', () => {
  it('finds components to read, so an empty scan can never report compliance', () => {
    // ⚠️ Without this, a renamed directory turns this whole file into a pass.
    expect(sources.length).toBeGreaterThan(20);
  });

  it('makes no claim the signed-in operator can see is false', () => {
    let examined = 0;

    for (const { name, text } of sources) {
      const lower = text.toLowerCase();

      for (const claim of REFUTED_BY_THE_DEPLOYED_PRODUCT) {
        examined += 1;
        expect(
          lower.includes(claim),
          `${name} still tells the operator "${claim}". The console has had a verified session since ADR-0074 slice 2 — the operator is reading this sentence inside one.`,
        ).toBe(false);
      }
    }

    // ⚠️ Count what was actually compared, not what was intended to be.
    expect(examined).toBe(sources.length * REFUTED_BY_THE_DEPLOYED_PRODUCT.length);
  });
});
