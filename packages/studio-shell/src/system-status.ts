/**
 * The System Status indicator (ADR-0058 D6) — what the console can honestly say
 * about itself.
 *
 * ⚠️ Every facet below has THREE or more values, never a boolean. The whole
 * point of this indicator is that "AGE has not looked" is a distinct answer from
 * "AGE looked and the answer is no". A green/red dot cannot express that, so
 * there is no green/red dot.
 */

import type { EpistemicState } from './epistemic-state';

/**
 * ⚠️ Identity is `not-established` — a THIRD value that is never `true` and
 * never `false` (ADR-0058 D2).
 *
 * 🚫 Identity must NOT be shown green. There is no identity system; nobody is
 * signed in, and nobody is signed out either. Rendering it as a healthy check
 * would tell the operator a subsystem is working when it does not exist.
 */
export type IdentityState = 'not-established';

/**
 * ⚠️ The capture store is `not-read` (ADR-0058 D6, ADR-0055 D7).
 *
 * 🚫 The console must NOT show "Last onboarding: Never". Nothing has read the
 * capture store, so "Never" would be an unlooked-at absence rendered as a
 * measured zero — the same error class as defaulting `sufficiency` to `ready`.
 * It reads "Not read".
 */
export type CaptureStoreState = 'not-read';

export interface StatusFacet {
  readonly id: string;
  readonly label: string;
  /** What the console can say. 🚫 Never a boolean, never a health colour. */
  readonly value: string;
  /** How it is rendered. 🚫 Never `known` unless a source was actually read. */
  readonly state: EpistemicState;
  /** Why the value is what it is, in words the operator can act on. */
  readonly detail: string;
}

export interface SystemStatusInput {
  /** The host the console actually bound to. */
  readonly bindHost: string;
  readonly bindPort: number;
  /** Whether the operator configured a client record file, and what happened. */
  readonly recordFile: 'not-configured' | 'refused' | 'read';
  readonly identity: IdentityState;
  readonly captureStore: CaptureStoreState;
}

/**
 * Build the status facets.
 *
 * ⚠️ `bindHost` is reported as a FACT, not as a guarantee. Loopback is
 * necessary, not sufficient: a reverse proxy or an SSH tunnel in front of a
 * loopback listener defeats it entirely, so the detail says what was bound and
 * 🚫 never claims the console is unreachable.
 */
export function presentSystemStatus(input: SystemStatusInput): readonly StatusFacet[] {
  return Object.freeze([
    Object.freeze({
      id: 'bind',
      label: 'Configured to bind',
      value: `${input.bindHost}:${String(input.bindPort)}`,
      state: 'known' as EpistemicState,
      // 🛑 THIS READ "The console refuses to start on a non-loopback host" AND
      // THAT SENTENCE WAS FALSE ON `main`: `assertLoopbackBindHost` had no
      // production caller, so nothing refused anything at startup. It was
      // rendered as `known` — a claim about code that did not exist, shown to
      // an operator as verified fact.
      //
      // ⚠️ IT NOW DESCRIBES ONLY WHAT IS ACTUALLY CHECKED: the start command
      // pins a loopback host, a guard holds that pin, and the value shown is
      // passed through the same policy. 🚫 It must NOT say "refuses to start"
      // again unless a startup refusal really runs, and 🚫 it must never claim
      // the console is unreachable.
      detail:
        'This is the host the console is configured to bind — pinned in its start command and ' +
        'checked against the one loopback policy. AGE cannot observe the socket it actually ' +
        'bound, so this is a configuration fact, not a measurement. Loopback is necessary, not ' +
        'sufficient: a proxy, tunnel or published container port in front of this listener ' +
        'defeats it entirely, and AGE cannot see that from here.',
    }),
    Object.freeze({
      id: 'identity',
      label: 'Identity',
      value: 'Not established',
      // ⚠️ NOT `unknown`: AGE has not looked, because there is nothing to look
      // at. 🚫 And never `known`, which would render as a working subsystem.
      state: 'not-assessed' as EpistemicState,
      detail:
        'There is no identity system. Nobody is signed in, and nobody is signed out — this is a third ' +
        'state, not a failed check. Every action here is attributed to the operator running the process.',
    }),
    Object.freeze({
      id: 'capture-store',
      label: 'Capture store',
      value: 'Not read',
      state: 'not-assessed' as EpistemicState,
      detail:
        'The console has not read the capture store. This is not "no snapshots" and not "never onboarded": ' +
        'nothing has looked. One real business must pass through the CLI capture path first (ADR-0055 D7).',
    }),
    Object.freeze({
      id: 'record-file',
      label: 'Client records',
      value: RECORD_FILE_VALUES[input.recordFile],
      state: RECORD_FILE_STATES[input.recordFile],
      detail: RECORD_FILE_DETAILS[input.recordFile],
    }),
    Object.freeze({
      id: 'execution',
      label: 'Business execution',
      value: 'Refused',
      state: 'known' as EpistemicState,
      detail:
        'Platform administration and knowledge authoring are permitted; business execution is not, and ' +
        'neither is anything AGE would initiate on its own — a schedule, a retry, a background recompute ' +
        'or an agent acting on a recommendation (ADR-0057 D4, class 3).',
    }),
  ]);
}

const RECORD_FILE_VALUES: Readonly<Record<SystemStatusInput['recordFile'], string>> = Object.freeze(
  {
    'not-configured': 'Not configured',
    refused: 'Refused',
    read: 'Read',
  },
);

const RECORD_FILE_STATES: Readonly<Record<SystemStatusInput['recordFile'], EpistemicState>> =
  Object.freeze({
    'not-configured': 'not-assessed' as EpistemicState,
    // ⚠️ A refusal is a RESULT — AGE looked and could not proceed. 🚫 It is not
    // "not assessed", which would suggest nothing was attempted.
    refused: 'unknown' as EpistemicState,
    read: 'known' as EpistemicState,
  });

const RECORD_FILE_DETAILS: Readonly<Record<SystemStatusInput['recordFile'], string>> =
  Object.freeze({
    'not-configured':
      'No record file path was supplied, so the console has not looked for one. This is not "no businesses".',
    refused:
      'The console tried to read the record file and refused it. The Businesses screen states why. ' +
      'No partial or repaired registry is used in its place.',
    read: 'The record file was read and every record validated at the boundary.',
  });
