import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import type {
  OrchestratedScoredBifSnapshotCaptureInput,
  ScoredBifSnapshotCaptureOutcome,
} from '@age/scored-bif-snapshot-persistence';
import { describe, expect, it } from 'vitest';

import type { CaptureConnection } from '../capture-runner';
import {
  ONBOARDING_EXIT_CODES,
  driverFailureLabelOf,
  runOnboarding,
  type OnboardingRuntime,
} from '../onboarding-runner';

/**
 * ADR-0054 D6 — the onboarding run, driven with no database and no filesystem.
 *
 * ⚠️ EVERY FIXTURE HERE IS CONSPICUOUSLY FICTIONAL, and that is a control, not
 * a style. ADR-0053 D3: a real client record is never committed, not even
 * redacted or masked, and obvious fictionality IS the guard. 🚫 Do not "make
 * these more realistic".
 *
 * The falsification test D7 states in advance is that a real client's answers,
 * in a file outside the repository, produce a stored snapshot under a scope
 * derived from a real `ClientRecord`. What this file proves is the SHAPE of
 * that: the scope reaching the capture chain came off the record, the answers
 * came off the operator's file, and neither was fabricated when missing. The
 * run against the operator's own database is the operator's to perform — this
 * suite cannot and does not stand in for it.
 */

const REPO_ROOT = '/home/operator/AGE';
const ANSWERS_PATH = '/home/operator/private/answers.json';
const RECORDS_PATH = '/home/operator/private/clients.json';

const INSTANT = new Date('2026-08-02T11:22:33.444Z');

const RECORDS_JSON = JSON.stringify({
  records: [
    {
      clientId: 'client-fictional-1',
      organizationId: 'org-fictional-1',
      displayName: 'Wholly Invented Widgets (FICTIONAL)',
      externalRefs: { rankops: 'rankops-client-example-001' },
    },
  ],
});

const ANSWERS_JSON = JSON.stringify({
  questionnaireId: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.id,
  questionnaireVersion: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.version,
  answers: [
    { questionId: 'bi-name', value: 'Wholly Invented Widgets (FICTIONAL)' },
    { questionId: 'bi-industry', value: 'Imaginary widget manufacturing' },
    {
      questionId: 'bi-model',
      value: 'Sells entirely fictional widgets to entirely fictional buyers.',
    },
  ],
});

const BASE_ARGS = [
  '--answers',
  ANSWERS_PATH,
  '--records',
  RECORDS_PATH,
  '--repository-root',
  REPO_ROOT,
  '--client-id',
  'client-fictional-1',
  '--changed-by',
  'operator:awanish',
  '--profile-id',
  'profile-fictional-1',
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
  readonly runtime: OnboardingRuntime;
  readonly opened: { count: number };
  readonly closed: { count: number };
  readonly reads: string[];
  readonly orchestrator: RecordingCaptureOrchestrator;
}

function harness(
  options: {
    readonly files?: Readonly<Record<string, string>>;
    readonly answer?: (
      input: OrchestratedScoredBifSnapshotCaptureInput,
    ) => ScoredBifSnapshotCaptureOutcome;
  } = {},
): Harness {
  const opened = { count: 0 };
  const closed = { count: 0 };
  const reads: string[] = [];
  const files = options.files ?? { [ANSWERS_PATH]: ANSWERS_JSON, [RECORDS_PATH]: RECORDS_JSON };

  const orchestrator = new RecordingCaptureOrchestrator(
    options.answer ??
      ((input) => ({
        status: 'captured',
        receipt: {
          bifId: 'bif-fictional-x',
          snapshotId: input.snapshotId,
          capturedAt: input.capturedAt,
        },
      })),
  );

  return {
    opened,
    closed,
    reads,
    orchestrator,
    runtime: {
      readOperatorFileText: (path: string): string => {
        reads.push(path);
        const text = files[path];
        if (text === undefined) {
          throw new Error(`ENOENT: ${path}`);
        }
        return text;
      },
      now: () => INSTANT,
      newSnapshotId: () => 'snapshot-minted-1',
      openLocalCaptureOrchestrator: async () => {
        opened.count += 1;

        return {
          orchestrator,
          close: async () => {
            closed.count += 1;
          },
        } as unknown as CaptureConnection;
      },
    },
  };
}

describe('runOnboarding — produceOnly', () => {
  it('produces a profile from the operator files and writes nothing', async () => {
    const { runtime, opened, orchestrator } = harness();

    const result = await runOnboarding(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.ok);
    expect(result.stderr).toEqual([]);
    // 🚫 D6 condition 4: the default mode opens no connection at all, so it
    // needs no database and no credentials.
    expect(opened.count).toBe(0);
    expect(orchestrator.calls).toEqual([]);
    expect(result.stdout).toContain('capture:         not requested');
  });

  it('echoes the organization as DERIVED from the record, never as typed', async () => {
    const { runtime } = harness();

    const result = await runOnboarding(BASE_ARGS, runtime);

    expect(result.stdout).toContain(
      'organizationId:  org-fictional-1 (from client record, not typed)',
    );
  });

  it('does not echo the client display name', async () => {
    // 🚫 This output is the thing most likely to be pasted into an issue, and
    // the record file holds a real business's name.
    const { runtime } = harness();

    const result = await runOnboarding(BASE_ARGS, runtime);

    expect(result.stdout.join('\n')).not.toContain('Wholly Invented Widgets');
  });

  it('reads the RECORD file before the answer file', async () => {
    // ⚠️ Order is load-bearing: a run with no scope has no business opening the
    // operator's answers.
    const { runtime, reads } = harness();

    await runOnboarding(BASE_ARGS, runtime);

    expect(reads).toEqual([RECORDS_PATH, ANSWERS_PATH]);
  });
});

describe('runOnboarding — refusals', () => {
  it('refuses an unknown client id without reading the answers', async () => {
    const { runtime, reads } = harness();

    const result = await runOnboarding(
      [...BASE_ARGS.slice(0, 7), 'client-not-in-the-file', ...BASE_ARGS.slice(8)],
      runtime,
    );

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.clientRecordRefused);
    expect(reads).toEqual([RECORDS_PATH]);
    // 🚫 Never fabricated into a usable scope.
    expect(result.stdout).toEqual([]);
  });

  it('refuses a record path inside the repository, before opening it', async () => {
    const { runtime, reads } = harness();
    const inside = `${REPO_ROOT}/clients.json`;

    const result = await runOnboarding(
      ['--records', inside, ...BASE_ARGS.slice(0, 2), ...BASE_ARGS.slice(4)],
      runtime,
    );

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.clientRecordRefused);
    expect(reads).toEqual([]);
    expect(result.stderr.join(' ')).toContain('inside the repository working tree');
    // ⚠️ `.gitignore` is not the control, and must never be offered as the fix.
    expect(result.stderr.join(' ')).not.toMatch(/gitignore/i);
  });

  it('refuses an answer path inside the repository, before opening it', async () => {
    const { runtime, reads } = harness();
    const inside = `${REPO_ROOT}/answers.json`;

    const result = await runOnboarding(['--answers', inside, ...BASE_ARGS.slice(2)], runtime);

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.answerFileRefused);
    expect(reads).toEqual([RECORDS_PATH]);
  });

  it('refuses an unreadable answer file rather than treating it as no answers', async () => {
    const { runtime } = harness({ files: { [RECORDS_PATH]: RECORDS_JSON } });

    const result = await runOnboarding(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.answerFileRefused);
    expect(result.stderr.join(' ')).toContain('could not be read');
  });

  it('refuses a changedBy that is not an operator principal', async () => {
    const { runtime } = harness();

    const result = await runOnboarding(
      [...BASE_ARGS.slice(0, 9), 'awanish', ...BASE_ARGS.slice(10)],
      runtime,
    );

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.clientRecordRefused);
    expect(result.stderr.join(' ')).toContain('operator:<handle>');
  });

  it('refuses bad arguments before touching any file', async () => {
    const { runtime, reads } = harness();

    const result = await runOnboarding([], runtime);

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.invalidArguments);
    expect(reads).toEqual([]);
  });
});

describe('runOnboarding — produceAndCapture', () => {
  const capturingArgs = [...BASE_ARGS, '--capture', '--confirm'] as const;

  it('captures under the scope taken from the record, not from any argument', async () => {
    const { runtime, orchestrator, opened, closed } = harness();

    const result = await runOnboarding(capturingArgs, runtime);

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.ok);
    expect(opened.count).toBe(1);
    expect(closed.count).toBe(1);
    expect(orchestrator.calls).toHaveLength(1);

    const captured = orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput;
    expect(captured.clientContext.clientId).toBe('client-fictional-1');
    expect(captured.clientContext.organizationId).toBe('org-fictional-1');
    expect(result.stdout).toContain('capture:         captured');
  });

  it('opens the LOCAL door and no other', async () => {
    // ⚠️ D6 condition 2 is enforced behind `openLocalCaptureOrchestrator`; the
    // runtime deliberately offers this command no other way to connect.
    const { runtime } = harness();

    expect(Object.keys(runtime)).not.toContain('openCaptureOrchestrator');
  });

  it('uses one instant for the profile, the mapping and the snapshot', async () => {
    const { runtime, orchestrator } = harness();

    await runOnboarding(capturingArgs, runtime);

    const captured = orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput;
    expect(captured.capturedAt).toBe(INSTANT.toISOString());
  });

  it('mints a snapshot id only when the operator did not pin one', async () => {
    const minted = harness();
    await runOnboarding(capturingArgs, minted.runtime);
    expect(
      (minted.orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput).snapshotId,
    ).toBe('snapshot-minted-1');

    const pinned = harness();
    await runOnboarding([...capturingArgs, '--snapshot-id', 'snap-pinned'], pinned.runtime);
    expect(
      (pinned.orchestrator.calls[0] as OrchestratedScoredBifSnapshotCaptureInput).snapshotId,
    ).toBe('snap-pinned');
  });

  it('reports a failed capture as a failure and still releases the connection', async () => {
    const { runtime, closed } = harness({
      answer: () => ({ status: 'failed', error: new Error('relation does not exist') }),
    });

    const result = await runOnboarding(capturingArgs, runtime);

    expect(result.exitCode).toBe(ONBOARDING_EXIT_CODES.captureFailed);
    expect(closed.count).toBe(1);
    // ⚠️ The driver's MESSAGE is not printed — its name is. A Prisma validation
    // error renders the whole `data` argument, which on this path is the
    // serialized `ScoredBifContext`: the client's business facts in their own
    // words. The name says what went wrong without saying what was written.
    expect(result.stderr.join(' ')).toContain('Capture failed: Error');
    expect(result.stderr.join(' ')).not.toContain('relation does not exist');
  });

  it('reports the driver error code when there is one, and never its message', async () => {
    const driverError = Object.assign(new Error('Invalid `prisma.scoredBifSnapshot.create()`'), {
      name: 'PrismaClientValidationError',
      code: 'P2002',
    });
    const { runtime } = harness({ answer: () => ({ status: 'failed', error: driverError }) });

    const result = await runOnboarding(capturingArgs, runtime);

    expect(result.stderr.join(' ')).toBe('Capture failed: PrismaClientValidationError (P2002)');
  });
});

describe('driverFailureLabelOf', () => {
  // Tested directly because `ScoredBifSnapshotCaptureFailed.error` is typed as
  // `Error`: the non-Error case cannot be reached through the runner without a
  // cast that would assert something the type says is impossible. It is still a
  // real case — the value originates in a driver this repository does not own.
  it('degrades an unrecognised value to a constant rather than stringifying it', () => {
    // 🚫 `String(error)` would print whatever a future driver decided to throw.
    expect(driverFailureLabelOf({ context: 'Wholly Invented Widgets' })).toBe(
      'the driver reported a non-Error failure',
    );
    expect(driverFailureLabelOf('Wholly Invented Widgets')).not.toContain('Wholly');
  });

  it('never returns the error message', () => {
    const error = Object.assign(new Error('Invalid `prisma.scoredBifSnapshot.create()`'), {
      name: 'PrismaClientValidationError',
    });
    expect(driverFailureLabelOf(error)).toBe('PrismaClientValidationError');
  });

  it('ignores a non-string or empty code rather than rendering it', () => {
    expect(driverFailureLabelOf(Object.assign(new Error('x'), { code: 42 }))).toBe('Error');
    expect(driverFailureLabelOf(Object.assign(new Error('x'), { code: '' }))).toBe('Error');
  });
});
