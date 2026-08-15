import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import { resolveDiscoveryWorkspace } from '@age/studio-shell';
import {
  assertOperatorFilePathOutsideRepository,
  OperatorFilePathRefusedError,
} from '@age/operator-file-policy';

import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';

/**
 * Locating the operator's discovery workspace — the one implementation.
 *
 * ⚠️ **EXTRACTED SO TWO MODULES CAN SHARE IT, 🚫 NOT SO A SECOND COPY COULD
 * EXIST.** ADR-0073 added a second operations module beside `operator-workspace`,
 * and the alternative to this file was each importing the other. The rule is
 * unchanged: 🚫 do not re-implement `assertOperatorFilePathOutsideRepository` —
 * the copy that gets relaxed still passes its own tests (ADR-0054 D2/D3).
 */

/** The questionnaire the console renders. There is exactly one. */
export const STUDIO_QUESTIONNAIRE = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;

export type DiscoveryWorkspaceOutcome =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'ready'; readonly directory: string };

/** Locate the workspace, and refuse it if it is inside the repository. */
export function resolveWorkspaceDirectory(
  runtime: OperatorWorkspaceRuntime,
): DiscoveryWorkspaceOutcome {
  const workspace = resolveDiscoveryWorkspace(runtime.env);

  if (workspace.kind === 'not-configured') {
    return { kind: 'not-configured', variable: workspace.variable };
  }

  try {
    assertOperatorFilePathOutsideRepository(
      workspace.directory,
      runtime.repositoryRoot(),
      'the discovery workspace directory',
    );
    return { kind: 'ready', directory: workspace.directory };
  } catch (error) {
    if (error instanceof OperatorFilePathRefusedError) {
      return { kind: 'refused', reason: error.message };
    }
    return {
      kind: 'refused',
      reason: 'The discovery workspace could not be used, and the failure was not recognised.',
    };
  }
}
