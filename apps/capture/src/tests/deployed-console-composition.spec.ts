import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REMOTE_ACKNOWLEDGEMENT } from '@age/deployed-database-target';

import {
  openDeployedPrismaObservationReadConnection,
  openDeployedPrismaSnapshotReadConnection,
} from '../deployed-console-composition';

/**
 * ADR-0074 §7 slice 1 — the deployed composition's shape and its refusals.
 *
 * ⚠️ NOTHING HERE CONNECTS. Every case asserts that the run is refused ABOVE
 * `new PrismaClient(`, so the assertions are about a decision, not a database.
 * A case that reached a driver would be a case that needed a live server to run,
 * which is precisely why the judgement is placed where it is.
 */

const MODULE_SOURCE = readFileSync(
  fileURLToPath(new URL('../deployed-console-composition.ts', import.meta.url)),
  'utf8',
);

const PUBLIC_TARGET = 'postgresql://age_app:secret@203.0.113.10:5432/age?schema=public';
const LOOPBACK_TARGET = 'postgresql://age_app:secret@127.0.0.1:5432/age?schema=public';

describe('the deployed composition refuses before it connects', () => {
  it('refuses a publicly reachable host on the snapshot read door', () => {
    expect(() =>
      openDeployedPrismaSnapshotReadConnection({
        acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
        datasourceUrl: PUBLIC_TARGET,
      }),
    ).toThrow(/203\.0\.113\.10/);
  });

  it('refuses a publicly reachable host on the observation read door', () => {
    expect(() =>
      openDeployedPrismaObservationReadConnection({
        acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
        datasourceUrl: PUBLIC_TARGET,
      }),
    ).toThrow(/203\.0\.113\.10/);
  });

  it('never puts the credential in the refusal', () => {
    let message = '';

    try {
      openDeployedPrismaSnapshotReadConnection({
        acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
        datasourceUrl: PUBLIC_TARGET,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain('secret');
    expect(message).not.toContain(PUBLIC_TARGET);
  });

  it('refuses when the acknowledgement was not written out', () => {
    expect(() =>
      openDeployedPrismaSnapshotReadConnection({
        // The cast is the point: it stands in for a caller that reached here
        // through `any`, plain JavaScript, or a value read from an environment.
        acknowledgedRemote: 'yes' as unknown as typeof REMOTE_ACKNOWLEDGEMENT,
        datasourceUrl: LOOPBACK_TARGET,
      }),
    ).toThrow(/acknowledgement/i);
  });

  it('refuses when DATABASE_URL_APP is absent, naming the variable and no value', () => {
    let message = '';

    try {
      openDeployedPrismaObservationReadConnection({
        acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
        environment: {},
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('DATABASE_URL_APP');
  });

  it('refuses when DATABASE_URL_APP is merely the owner connection renamed', () => {
    expect(() =>
      openDeployedPrismaSnapshotReadConnection({
        acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
        environment: {
          DATABASE_URL: LOOPBACK_TARGET,
          DATABASE_URL_APP: LOOPBACK_TARGET,
        },
      }),
    ).toThrow(/same connection/i);
  });
});

describe('the deployed composition has two doors and both only read', () => {
  it('binds no write operation anywhere in the module', () => {
    // ⚠️ Comments are stripped first: this file's own prose names the very
    // tokens it forbids, and a scan that matched them would pass by accident.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code.length).toBeGreaterThan(0);

    for (const forbidden of ['append', 'orchestrator', 'update', 'upsert', 'delete']) {
      expect(code).not.toContain(forbidden);
    }
  });

  /**
   * ⚠️ **THE LIST GREW BY ONE, DELIBERATELY, AND THE CLAIM DID NOT.**
   * `judgeDeployedDatabase` is 🚫 not a door — it opens nothing, connects to
   * nothing and returns a JUDGEMENT. It became exported for exactly one caller,
   * `deployed-session-composition.ts`, so that the session door runs the SAME
   * A5 check against the SAME resolution instead of growing a second copy that
   * could be relaxed on its own (ADR-0061 A5: *"the copy that gets relaxed still
   * passes its own tests"*).
   *
   * 🛑 **THE DOOR COUNT IS STILL TWO AND BOTH STILL ONLY READ.** The `update` /
   * `append` / `upsert` / `delete` scan above is untouched and still finds
   * nothing, because the door that can write `revokedAt` lives in the other
   * file. 🚫 Do not add a third `open…` function here.
   */
  it('exports exactly the two read doors, plus the shared judgement', () => {
    const exported = [...MODULE_SOURCE.matchAll(/^export function (\w+)/gm)].map(
      (match) => match[1],
    );

    expect(exported).toEqual([
      'judgeDeployedDatabase',
      'openDeployedPrismaSnapshotReadConnection',
      'openDeployedPrismaObservationReadConnection',
    ]);

    // 🛑 The claim that matters is about DOORS, so it is asserted separately
    // from the export list — a future export cannot quietly become a door.
    expect(exported.filter((name) => (name ?? '').startsWith('open'))).toHaveLength(2);
  });

  it('binds neither findBySnapshotId nor listForOrganization beyond its own door', () => {
    const snapshot = openDeployedPrismaSnapshotReadConnection({
      acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
      datasourceUrl: LOOPBACK_TARGET,
    });

    expect(Object.keys(snapshot).sort()).toEqual(['close', 'findBySnapshotId', 'findLatest']);

    const observations = openDeployedPrismaObservationReadConnection({
      acknowledgedRemote: REMOTE_ACKNOWLEDGEMENT,
      datasourceUrl: LOOPBACK_TARGET,
    });

    expect(Object.keys(observations).sort()).toEqual(['close', 'listForOrganization']);
  });
});
