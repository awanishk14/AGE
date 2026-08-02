import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '@age/business-discovery-contracts';
import type {
  OrchestratedScoredBifSnapshotCaptureInput,
  ScoredBifSnapshotCaptureOrchestrator,
  ScoredBifSnapshotCaptureOutcome,
} from '@age/scored-bif-snapshot-persistence';
import { describe, expect, it } from 'vitest';

import { CAPTURE_EXIT_CODES, runCapture, type CaptureRuntime } from '../capture-runner';

/**
 * ADR-0043 Slice B2 — the run logic, driven with no database and no filesystem.
 *
 * Every effect is a fake here, which is the point of the seam: the decisions
 * this CLI makes about an APPEND-ONLY table that grants only SELECT and INSERT
 * are all provable without one.
 */

const PROFILE_JSON = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);

const INSTANT = new Date('2026-07-30T11:22:33.444Z');

const BASE_ARGS = [
  '--profile',
  '/tmp/profile.json',
  '--client-id',
  'client-a',
  '--organization-id',
  'org-alpha',
  '--changed-by',
  'analyst@example.com',
] as const;

/** Records what it was asked to capture, and answers however the test says. */
class RecordingCaptureOrchestrator {
  readonly calls: OrchestratedScoredBifSnapshotCaptureInput[] = [];

  constructor(
    private readonly answer: (
      input: OrchestratedScoredBifSnapshotCaptureInput,
    ) => ScoredBifSnapshotCaptureOutcome,
  ) {}

  async capture(
    input: OrchestratedScoredBifSnapshotCaptureInput,
  ): Promise<ScoredBifSnapshotCaptureOutcome> {
    this.calls.push(input);

    return this.answer(input);
  }
}

interface Harness {
  readonly runtime: CaptureRuntime;
  readonly opened: { count: number };
  readonly closed: { count: number };
  readonly reads: string[];
  readonly orchestrator: RecordingCaptureOrchestrator;
}

function harness(
  options: {
    readonly text?: string;
    readonly readThrows?: Error;
    readonly answer?: (
      input: OrchestratedScoredBifSnapshotCaptureInput,
    ) => ScoredBifSnapshotCaptureOutcome;
  } = {},
): Harness {
  const opened = { count: 0 };
  const closed = { count: 0 };
  const reads: string[] = [];
  const orchestrator = new RecordingCaptureOrchestrator(
    options.answer ??
      ((input) => ({
        status: 'captured',
        receipt: {
          bifId: 'bif-x',
          snapshotId: input.snapshotId,
          capturedAt: input.capturedAt,
        },
      })),
  );

  const runtime: CaptureRuntime = {
    readProfileText: (path: string): string => {
      reads.push(path);
      if (options.readThrows !== undefined) {
        throw options.readThrows;
      }

      return options.text ?? PROFILE_JSON;
    },
    now: () => INSTANT,
    newSnapshotId: () => 'minted-snapshot-id',
    openCaptureOrchestrator: async () => {
      opened.count += 1;

      return {
        orchestrator: orchestrator as unknown as ScoredBifSnapshotCaptureOrchestrator,
        close: async () => {
          closed.count += 1;
        },
      };
    },
  };

  return { runtime, opened, closed, reads, orchestrator };
}

describe('runCapture — argument and input failures', () => {
  it('reports every argument error at once and writes nothing', async () => {
    const { runtime, opened, reads } = harness();

    const result = await runCapture([], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.invalidArguments);
    expect(result.stderr.length).toBeGreaterThan(1);
    expect(result.stdout).toEqual([]);
    // The profile is not even read: a run that cannot be understood is not begun.
    expect(reads).toEqual([]);
    expect(opened.count).toBe(0);
  });

  it('reports an unreadable profile as its own failure, distinct from an invalid one', async () => {
    const { runtime, opened } = harness({ readThrows: new Error('ENOENT: no such file') });

    const result = await runCapture([...BASE_ARGS], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.profileUnreadable);
    expect(result.stderr[0]).toContain('/tmp/profile.json');
    expect(result.stderr[0]).toContain('ENOENT');
    expect(opened.count).toBe(0);
  });

  it('rejects a document that is not a valid discovery profile', async () => {
    const { runtime, opened } = harness({ text: '{"nope": true}' });

    const result = await runCapture([...BASE_ARGS], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.invalidProfile);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(opened.count).toBe(0);
  });
});

describe('runCapture — produceOnly', () => {
  it('produces a context, opens no connection, and says capture was not requested', async () => {
    const { runtime, opened, closed } = harness();

    const result = await runCapture([...BASE_ARGS], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.ok);
    expect(result.stderr).toEqual([]);
    // ADR-0043 D7 / ADR-0040 D7: no default that writes.
    expect(opened.count).toBe(0);
    expect(closed.count).toBe(0);
    expect(result.stdout).toContain('capture:         not requested');
  });

  it('echoes the scope it was given, in full (D4 mitigation 2)', async () => {
    const { runtime } = harness();

    const result = await runCapture([...BASE_ARGS], runtime);

    expect(result.stdout).toContain('mode:            produceOnly');
    expect(result.stdout).toContain('clientId:        client-a');
    expect(result.stdout).toContain('organizationId:  org-alpha');
    expect(result.stdout).toContain('changedBy:       analyst@example.com');
  });

  it('never reports the BIF as promoted', async () => {
    const { runtime } = harness();

    const result = await runCapture([...BASE_ARGS], runtime);

    expect(result.stdout).toContain('bifStatus:       Draft');
    expect(result.stdout.join('\n')).not.toContain('Active');
  });
});

describe('runCapture — produceAndCapture', () => {
  const CAPTURE_ARGS = [...BASE_ARGS, '--capture', '--confirm'] as const;

  it('captures through the injected chain and releases the connection', async () => {
    const { runtime, opened, closed, orchestrator } = harness();

    const result = await runCapture([...CAPTURE_ARGS], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.ok);
    expect(opened.count).toBe(1);
    expect(closed.count).toBe(1);
    expect(orchestrator.calls).toHaveLength(1);
  });

  it('takes scope from the arguments, never from the payload', async () => {
    const { runtime, orchestrator } = harness();

    await runCapture([...CAPTURE_ARGS], runtime);

    const input = orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput;
    expect(input.clientContext.clientId).toBe('client-a');
    expect(input.clientContext.organizationId).toBe('org-alpha');
  });

  it('mints the snapshot id and stamps capturedAt from the single injected instant', async () => {
    const { runtime, orchestrator } = harness();

    await runCapture([...CAPTURE_ARGS], runtime);

    const input = orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput;
    expect(input.snapshotId).toBe('minted-snapshot-id');
    expect(input.capturedAt).toBe('2026-07-30T11:22:33.444Z');
  });

  it('prefers the operator-pinned snapshot id and instant when given', async () => {
    const { runtime, orchestrator } = harness();

    await runCapture(
      [
        ...CAPTURE_ARGS,
        '--snapshot-id',
        'snap-pinned',
        '--captured-at',
        '2026-01-02T03:04:05.006Z',
      ],
      runtime,
    );

    const input = orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput;
    expect(input.snapshotId).toBe('snap-pinned');
    expect(input.capturedAt).toBe('2026-01-02T03:04:05.006Z');
  });

  it('reports a capture failure as its own exit code, unclassified', async () => {
    const { runtime, closed } = harness({
      answer: () => ({ status: 'failed', error: new Error('insert refused') }),
    });

    const result = await runCapture([...CAPTURE_ARGS], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.captureFailed);
    // ⚠️ The driver's MESSAGE is not printed — its name is. A Prisma validation
    // error renders the whole `data` argument, which on this path is the
    // serialized `ScoredBifContext`. Same rule as `onboard`; this path shipped
    // without it because it was the fixture path, and a fixture path is not a
    // reason to keep a leak that costs one word to close.
    expect(result.stderr).toEqual(['Capture failed: Error']);
    expect(result.stderr.join(' ')).not.toContain('insert refused');
    // The produced context is still reported: it was genuinely produced.
    expect(result.stdout).toContain('bifStatus:       Draft');
    expect(closed.count).toBe(1);
  });

  it('reports the driver error code when there is one, and never its message', async () => {
    const driverError = Object.assign(new Error('Invalid `prisma.scoredBifSnapshot.create()`'), {
      name: 'PrismaClientValidationError',
      code: 'P2002',
    });
    const { runtime } = harness({ answer: () => ({ status: 'failed', error: driverError }) });

    const result = await runCapture([...CAPTURE_ARGS], runtime);

    expect(result.stderr).toEqual(['Capture failed: PrismaClientValidationError (P2002)']);
  });

  it('releases the connection even when the chain throws', async () => {
    const { runtime, closed } = harness({
      answer: () => {
        throw new Error('connection lost');
      },
    });

    await expect(runCapture([...CAPTURE_ARGS], runtime)).rejects.toThrow('connection lost');
    expect(closed.count).toBe(1);
  });

  it('refuses --capture without --confirm and opens nothing', async () => {
    const { runtime, opened } = harness();

    const result = await runCapture([...BASE_ARGS, '--capture'], runtime);

    expect(result.exitCode).toBe(CAPTURE_EXIT_CODES.invalidArguments);
    expect(opened.count).toBe(0);
  });
});
