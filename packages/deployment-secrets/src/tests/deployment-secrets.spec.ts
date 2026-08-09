import { describe, expect, it } from 'vitest';

import {
  absentDeploymentSecrets,
  DeploymentSecretsRefusedError,
  REQUIRED_DEPLOYMENT_SECRETS,
  requireDeploymentSecrets,
} from '../deployment-secrets';

const SECRET = 'postgresql://age_app:s3cr3t-p4ssw0rd@127.0.0.1:5432/age';

const complete = (overrides: Record<string, string | undefined> = {}) => ({
  DATABASE_URL_APP: SECRET,
  ...overrides,
});

describe('a complete environment starts', () => {
  it('returns every required secret', () => {
    expect(requireDeploymentSecrets(complete())).toEqual({ DATABASE_URL_APP: SECRET });
  });

  it('trims surrounding whitespace, which a secret file adds', () => {
    expect(requireDeploymentSecrets(complete({ DATABASE_URL_APP: `  ${SECRET}\n` }))).toEqual({
      DATABASE_URL_APP: SECRET,
    });
  });

  it('hands back a frozen record', () => {
    expect(Object.isFrozen(requireDeploymentSecrets(complete()))).toBe(true);
  });

  it('carries nothing the environment happened to also contain', () => {
    const resolved = requireDeploymentSecrets(complete({ AWS_SECRET_ACCESS_KEY: 'unrelated' }));

    expect(Object.keys(resolved)).toEqual([...REQUIRED_DEPLOYMENT_SECRETS]);
  });
});

describe('an absent secret is a refusal, not a default', () => {
  it.each([
    ['undefined', undefined],
    ['blank', ''],
    ['whitespace only', '   \n'],
  ])('refuses a %s value', (_case, value) => {
    expect(() => requireDeploymentSecrets(complete({ DATABASE_URL_APP: value }))).toThrow(
      DeploymentSecretsRefusedError,
    );
  });

  it('refuses an entirely empty environment', () => {
    expect(() => requireDeploymentSecrets({})).toThrow(DeploymentSecretsRefusedError);
  });

  it('names every absent variable, in one refusal', () => {
    try {
      requireDeploymentSecrets({});
      expect.unreachable('an empty environment must not start');
    } catch (error) {
      const refusal = error as DeploymentSecretsRefusedError;
      expect(refusal.missing).toEqual([...REQUIRED_DEPLOYMENT_SECRETS]);
      for (const name of REQUIRED_DEPLOYMENT_SECRETS) {
        expect(refusal.message).toContain(name);
      }
    }
  });

  it('never puts a value, a length or a prefix of one in the refusal', () => {
    // 🛑 THE LOAD-BEARING ONE. This module handles secrets; a refusal that
    // quotes one has written a credential to a log and a CI transcript.
    try {
      requireDeploymentSecrets(complete({ DATABASE_URL_APP: '   ' }));
      expect.unreachable('a blank secret must not start');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain('s3cr3t');
      expect(message).not.toContain('postgres');
    }
  });

  it('does not leak the value of the secrets that WERE present', () => {
    try {
      requireDeploymentSecrets({ DATABASE_URL_APP: undefined, OTHER: SECRET });
      expect.unreachable('an absent secret must not start');
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRET);
    }
  });
});

describe('a status surface can ask instead of catching', () => {
  it('reports nothing absent when the environment is complete', () => {
    expect(absentDeploymentSecrets(complete())).toEqual([]);
  });

  it('reports the names of the absent ones', () => {
    expect(absentDeploymentSecrets({})).toEqual([...REQUIRED_DEPLOYMENT_SECRETS]);
  });

  it('is not a way to start anyway', () => {
    // ⚠️ Asking politely changes nothing: the same environment still refuses.
    expect(absentDeploymentSecrets({}).length).toBeGreaterThan(0);
    expect(() => requireDeploymentSecrets({})).toThrow(DeploymentSecretsRefusedError);
  });
});

describe('what the required list must and must not contain', () => {
  it('requires the application role, not the owner role', () => {
    // 🚫 A process holding owner credentials all day can drop a table by
    // accident; migrations are a separate act by a separate role.
    expect(REQUIRED_DEPLOYMENT_SECRETS).toContain('DATABASE_URL_APP');
    expect(REQUIRED_DEPLOYMENT_SECRETS).not.toContain('DATABASE_URL');
  });

  it('is frozen, so no caller can shorten it at runtime', () => {
    expect(Object.isFrozen(REQUIRED_DEPLOYMENT_SECRETS)).toBe(true);
  });
});
