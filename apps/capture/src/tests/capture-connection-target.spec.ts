import { describe, expect, it } from 'vitest';

import {
  CAPTURE_DATASOURCE_ENV_VAR,
  OWNER_DATASOURCE_ENV_VAR,
  resolveCaptureDatasourceUrl,
} from '../capture-connection-target';

/**
 * ADR-0046 D4, Slice 2.
 *
 * The behaviour under test is a refusal, so most of these cases assert that
 * NOTHING usable comes back. The failure this guards against is not a crash —
 * it is the opposite: a run that connects successfully as the wrong identity
 * and writes a row that looks correct.
 */

const APP_URL = 'postgresql://age_app:secret@localhost:5432/age_test?schema=public';
const OWNER_URL = 'postgresql://age:secret@localhost:5432/age_test?schema=public';

describe('resolveCaptureDatasourceUrl', () => {
  it('resolves the non-owner application connection', () => {
    const resolved = resolveCaptureDatasourceUrl({
      [CAPTURE_DATASOURCE_ENV_VAR]: APP_URL,
      [OWNER_DATASOURCE_ENV_VAR]: OWNER_URL,
    });

    expect(resolved).toEqual({ ok: true, url: APP_URL });
  });

  it('resolves without an owner connection present at all', () => {
    // The owner variable is not a dependency — it is only ever refused.
    expect(resolveCaptureDatasourceUrl({ [CAPTURE_DATASOURCE_ENV_VAR]: APP_URL })).toEqual({
      ok: true,
      url: APP_URL,
    });
  });

  it('refuses, and never falls back to the owner connection, when the app variable is absent', () => {
    const resolved = resolveCaptureDatasourceUrl({ [OWNER_DATASOURCE_ENV_VAR]: OWNER_URL });

    expect(resolved.ok).toBe(false);
    // The precise failure mode: an owner connection is available and is still
    // not used.
    expect(JSON.stringify(resolved)).not.toContain(OWNER_URL);
  });

  it.each([undefined, '', '   '])('treats %p as unset rather than as a connection', (value) => {
    expect(resolveCaptureDatasourceUrl({ [CAPTURE_DATASOURCE_ENV_VAR]: value }).ok).toBe(false);
  });

  it('refuses the owner connection wearing the application variable name', () => {
    const resolved = resolveCaptureDatasourceUrl({
      [CAPTURE_DATASOURCE_ENV_VAR]: OWNER_URL,
      [OWNER_DATASOURCE_ENV_VAR]: OWNER_URL,
    });

    expect(resolved.ok).toBe(false);
  });

  it('compares the two connections ignoring surrounding whitespace', () => {
    expect(
      resolveCaptureDatasourceUrl({
        [CAPTURE_DATASOURCE_ENV_VAR]: `  ${OWNER_URL}  `,
        [OWNER_DATASOURCE_ENV_VAR]: OWNER_URL,
      }).ok,
    ).toBe(false);
  });

  it('never puts a connection string in an error message', () => {
    const resolved = resolveCaptureDatasourceUrl({
      [CAPTURE_DATASOURCE_ENV_VAR]: OWNER_URL,
      [OWNER_DATASOURCE_ENV_VAR]: OWNER_URL,
    });

    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      for (const error of resolved.errors) {
        // Names, never values: a connection string carries a password.
        expect(error).toContain(CAPTURE_DATASOURCE_ENV_VAR);
        expect(error).not.toContain('secret');
        expect(error).not.toContain('postgresql://');
      }
    }
  });
});
