import type {
  ScoredBifSnapshotKey,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import { AGE_PEER_CONTRACT, PEER_CONTEXT_DOCUMENT } from '@age/client-context-projection';
import { describe, expect, it } from 'vitest';

import { PROJECT_EXIT_CODES, runProject } from '../project-runner';
import type { InspectRuntime } from '../inspect-runner';

/**
 * The outbound half of the peer contract, driven with no database.
 *
 * ⚠️ EVERY FIXTURE IS CONSPICUOUSLY FICTIONAL (ADR-0053 D3, ADR-0065 D1).
 *
 * ⚠️ **WHAT THIS SUITE DOES NOT PROVE.** It proves the shape: which scope
 * reached the store, that a miss is a miss, that `asOf` is the row's capture
 * time and not a clock, and that stdout is parseable by a program. 🚫 It is not
 * evidence that a peer product consumed anything — that is a round trip against
 * two running systems, and this suite must never be cited as if it were one.
 */

const REPO_ROOT = '/home/operator/AGE';
const RECORDS_PATH = '/home/operator/private/clients.json';
const CAPTURED_AT = '2026-08-08T09:10:11.123Z';

const RECORDS_JSON = JSON.stringify({
  records: [
    {
      clientId: 'client-fictional-1',
      organizationId: 'org-fictional-1',
      displayName: 'Wholly Invented Widgets (FICTIONAL)',
      externalRefs: {},
    },
  ],
});

const BASE_ARGS = [
  '--records',
  RECORDS_PATH,
  '--repository-root',
  REPO_ROOT,
  '--client-id',
  'client-fictional-1',
  '--bif-id',
  'bif-fictional-1',
] as const;

const RECORD: ScoredBifSnapshotRecord = {
  clientId: 'client-fictional-1',
  organizationId: 'org-fictional-1',
  bifId: 'bif-fictional-1',
  snapshotId: 'snap-fictional-1',
  capturedAt: CAPTURED_AT,
  snapshot: {
    snapshotVersion: '1.0.0',
    context: {
      contextVersion: '1.0.0',
      bifId: 'bif-fictional-1',
      bifStatus: 'Draft',
      bifConfidenceScore: 14,
      bifCompletenessScore: 11,
      sections: [
        {
          id: 'section-1',
          type: 'business_identity',
          name: 'Business Identity',
          confidenceScore: 20,
          completenessScore: 25,
          fields: [],
        },
      ],
      omittedSections: [{ type: 'financial_profile', name: 'Financial Profile' }],
      warnings: [],
      reasons: [],
      metadata: {
        presentSectionCount: 1,
        omittedSectionCount: 1,
        canonicalSectionCount: 2,
        populatedFieldCount: 0,
      },
    },
  },
} as unknown as ScoredBifSnapshotRecord;

function harness(options: { readonly found?: ScoredBifSnapshotRecord | null } = {}): {
  readonly runtime: InspectRuntime;
  readonly latest: ScoredBifSnapshotSeriesKey[];
  readonly closed: { count: number };
} {
  const latest: ScoredBifSnapshotSeriesKey[] = [];
  const closed = { count: 0 };
  const found = options.found === undefined ? RECORD : options.found;

  return {
    latest,
    closed,
    runtime: {
      readOperatorFileText: (path: string): string => {
        if (path !== RECORDS_PATH) throw new Error(`ENOENT: ${path}`);
        return RECORDS_JSON;
      },
      openSnapshotReadConnection: async () => ({
        findBySnapshotId: async (_key: ScoredBifSnapshotKey) => found,
        findLatest: async (key: ScoredBifSnapshotSeriesKey) => {
          latest.push(key);
          return found;
        },
        close: async () => {
          closed.count += 1;
        },
      }),
    },
  };
}

describe('age-capture project — the outbound half of `age.peer.v1`', () => {
  it('emits one parseable contract document on stdout and nothing else', async () => {
    const { runtime } = harness();

    const result = await runProject(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(PROJECT_EXIT_CODES.ok);
    expect(result.stderr).toEqual([]);
    // 🚫 ONE ELEMENT. A banner or an echoed scope would make the file
    // unparseable for the only consumer it has.
    expect(result.stdout).toHaveLength(1);

    const document: unknown = JSON.parse(result.stdout[0] as string);

    expect(document).toMatchObject({
      contract: AGE_PEER_CONTRACT,
      document: PEER_CONTEXT_DOCUMENT,
      projection: { bifId: 'bif-fictional-1' },
    });
  });

  it('carries the stored row’s capture time as `asOf`, never a clock', async () => {
    const { runtime } = harness();

    const result = await runProject(BASE_ARGS, runtime);
    const { projection } = JSON.parse(result.stdout[0] as string) as {
      projection: { asOf: string };
    };

    expect(projection.asOf).toBe(CAPTURED_AT);
  });

  it('projects every subject kind with its own state and reason — none omitted', async () => {
    const { runtime } = harness();

    const result = await runProject(BASE_ARGS, runtime);
    const { projection } = JSON.parse(result.stdout[0] as string) as {
      projection: {
        subjectKinds: readonly { subjectKind: string; state: string; because: string }[];
        notices: readonly string[];
      };
    };

    expect(projection.subjectKinds.map((kind) => kind.subjectKind)).toEqual([
      'service',
      'audience',
      'geography',
      'priority',
      'constraint',
    ]);
    // ⚠️ Every kind says WHY it is in its state. A blank reason is how
    // `never-captured` starts being read as "the business has none".
    for (const kind of projection.subjectKinds) {
      expect(kind.because.length).toBeGreaterThan(0);
    }
    expect(projection.notices.length).toBeGreaterThan(0);
  });

  it('carries no score across the boundary', async () => {
    const { runtime } = harness();

    const result = await runProject(BASE_ARGS, runtime);

    expect(result.stdout[0]).not.toContain('bifConfidenceScore');
    expect(result.stdout[0]).not.toContain('bifCompletenessScore');
    expect(result.stdout[0]).not.toContain('discoveryConfidenceScore');
  });

  it('never echoes the client’s display name', async () => {
    const { runtime } = harness();

    const result = await runProject(BASE_ARGS, runtime);

    expect(result.stdout.join('\n')).not.toContain('Wholly Invented Widgets');
  });

  it('derives the organization from the record rather than accepting a typed one', async () => {
    const { runtime, latest } = harness();

    const result = await runProject([...BASE_ARGS, '--organization-id', 'org-elsewhere'], runtime);

    expect(result.exitCode).toBe(PROJECT_EXIT_CODES.invalidArguments);
    expect(result.stderr.join(' ')).toContain('--organization-id is not accepted here');
    // 🚫 Nothing reached the store: a refused argument list must cost nothing.
    expect(latest).toEqual([]);
  });

  it('reports a miss as a miss and emits no document at all', async () => {
    const { runtime } = harness({ found: null });

    const result = await runProject(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(PROJECT_EXIT_CODES.snapshotNotFound);
    // 🚫 NOT an empty projection. "No snapshot in this scope" is a statement
    // about the query; an empty document is a statement about the business.
    expect(result.stdout).toEqual([]);
    expect(result.stderr.join(' ')).toContain('says nothing about the business');
  });

  it('releases the connection even when the row is a miss', async () => {
    const { runtime, closed } = harness({ found: null });

    await runProject(BASE_ARGS, runtime);

    expect(closed.count).toBe(1);
  });

  it('scopes the read by the record’s organization', async () => {
    const { runtime, latest } = harness();

    await runProject(BASE_ARGS, runtime);

    expect(latest).toEqual([
      {
        clientId: 'client-fictional-1',
        organizationId: 'org-fictional-1',
        bifId: 'bif-fictional-1',
      },
    ]);
  });
});
