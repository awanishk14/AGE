import type {
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import { buildStoredSnapshotView, type StoredSnapshotView } from '@age/studio-shell';

import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';
import { resolveBusinessScope } from './operator-workspace';

/**
 * Reading the stored row on behalf of a surface (ADR-0064).
 *
 * ⚠️ WHY THIS IS AN OPERATION AND NOT A SCREEN CONCERN. The console already
 * assesses the operator's **answer file**; `age-capture assess` assesses the
 * **immutable stored row**. Both answers existed on `main` and no surface said
 * they were different questions. This is the read half of closing that.
 *
 * 🚫 IT CANNOT WRITE, AND NOT BECAUSE IT DECLINES TO. `SnapshotReadPort` carries
 * one read and a close. There is no `append` on it to call, no orchestrator to
 * hand a record to, and no branch that could acquire one — the same construction
 * `apps/capture`'s `inspect` uses, and for the same reason: a read surface
 * holding a live append handle is a `produceAndCapture` waiting to happen
 * (ADR-0046 D7, ADR-0055 D2).
 *
 * 🚫 `findBySnapshotId` AND `listSeries` ARE BOTH ABSENT, and those are separate
 * refusals. Cross-snapshot reading — a series listing, a diff, "what changed
 * since last capture" — is ADR-0055 §5 item 1: recorded, NOT authorized. It
 * would be one method on this port away from existing, which is exactly why the
 * method is not here.
 *
 * ⚠️ ORDER IS LOAD-BEARING, as in `inspect`: the client record is resolved
 * BEFORE a connection is opened, because a request with no scope has no business
 * opening a database connection. An unknown business must cost nothing and
 * reach nothing.
 */

/**
 * The one read, and the means to shut the connection down again.
 *
 * ⚠️ A PORT, NOT AN IMPLEMENTATION. The surface supplies it — `apps/studio`
 * binds the existing ADR-0055 D2 façade from `@age/capture/composition`, and a
 * test binds an in-memory one. 🚫 There is no second reader in this repository
 * and this interface must never become one.
 */
export interface SnapshotReadPort {
  readonly findLatest: (key: ScoredBifSnapshotSeriesKey) => Promise<ScoredBifSnapshotRecord | null>;
  readonly close: () => Promise<void>;
}

/**
 * How the surface acquires the port.
 *
 * A function, not a value, for the same reason `inspect` takes one: an unknown
 * client must not have opened a connection, which means the connection cannot
 * exist before that check has run. ⚠️ It may THROW — a missing or
 * owner-pointing `DATABASE_URL_APP` refuses above `new PrismaClient(` — and that
 * throw is caught here and named, never crashed through to a blank screen.
 */
export type OpenSnapshotRead = () => SnapshotReadPort | Promise<SnapshotReadPort>;

/**
 * Narrows a wider read façade down to the one read this operation may perform.
 *
 * ⚠️ THE ADR-0055 D2 FAÇADE ALREADY CANNOT WRITE — it binds out two reads and a
 * close, and the repository itself never escapes the function that built it. But
 * it carries `findBySnapshotId` as well, and 🚫 addressing a snapshot by id is
 * how a surface starts comparing two of them. ADR-0055 §5 item 1 records
 * cross-snapshot reading as NOT authorized, and this is where that stops being a
 * convention.
 *
 * 🚫 It rebinds rather than spreading: a spread would carry every other property
 * the façade grows later, silently, and the point is that it does not.
 */
export function narrowSnapshotRead(connection: SnapshotReadPort): SnapshotReadPort {
  return {
    findLatest: (key) => connection.findLatest(key),
    close: () => connection.close(),
  };
}

export type StoredSnapshotOutcome =
  | {
      readonly kind: 'found';
      readonly view: StoredSnapshotView;
      /** Echoed back so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  /**
   * ⚠️ ADR-0064 D5. A named state carrying its reason — 🚫 never an empty panel,
   * never a zero, never "no data", and never a clean bill of health. This is
   * `detectContradictions`' failure mode restated: an absent look must never
   * render as a completed look that found nothing.
   */
  | { readonly kind: 'no-snapshot'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 🚫 A statement about the QUERY, never about the client.
 *
 * ⚠️ It says so explicitly, because a wrong BIF id produces exactly the same
 * answer as a business that was never captured. Rendering "nothing found" as
 * "this business has no capture" would be a claim AGE has no basis for.
 */
const noSnapshotReason = (bifId: string): string =>
  `No snapshot is stored under BIF id "${bifId}" for this business. That is a statement about ` +
  'this query and not about the business: a BIF id that was never captured under, and a business ' +
  'that was never captured, look identical from here. Nothing has been assessed and nothing is ' +
  'implied.';

export async function readStoredSnapshot(
  runtime: OperatorWorkspaceRuntime,
  openRead: OpenSnapshotRead,
  entitledOrganizationId: string,
  clientId: string,
  bifId: string,
): Promise<StoredSnapshotOutcome> {
  const trimmedBifId = bifId.trim();
  if (trimmedBifId === '') {
    // 🚫 Never defaulted and never derived. The stored row's series id was
    // chosen at capture time by whoever ran the capture; AGE cannot recover it,
    // and guessing one would query a scope nobody wrote to and report the miss
    // as though it meant something.
    return {
      kind: 'refused',
      reason:
        'A BIF id is required. AGE cannot derive it: the id was chosen when the snapshot was ' +
        'captured, and reading across snapshots to find it is not authorized.',
    };
  }

  const scope = resolveBusinessScope(runtime, entitledOrganizationId, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      reason:
        // ⚠️ Deliberately NOT the wording `operator-workspace.ts` uses. That
        // sentence is a marker a guard uses to prove `resolveBusinessScope` has
        // exactly one implementation; repeating it here would make this module
        // look like a second one. It calls that function rather than repeating
        // it, and says the same thing in its own words.
        'That business is not in the client record file, so there is no scope to read a stored ' +
        'snapshot under. Nothing is guessed: the organization is only ever read off the record.',
    };
  }

  const series: ScoredBifSnapshotSeriesKey = {
    clientId: scope.client.clientId,
    organizationId: scope.client.organizationId,
    bifId: trimmedBifId,
  };

  let port: SnapshotReadPort;
  try {
    port = await openRead();
  } catch (error) {
    // ⚠️ A deployment fault, named as one. 🚫 The message never carries a
    // connection string — `resolveCaptureDatasourceUrl` names variables, never
    // their values, and this passes that message through unchanged.
    return { kind: 'refused', reason: messageOf(error) };
  }

  let found: ScoredBifSnapshotRecord | null;
  try {
    // ⚠️ NOT WRAPPED IN ITS OWN CATCH, DELIBERATELY. A stored row that fails
    // `normalizeScoredBifSnapshotRecord` propagates: stored rows are untrusted
    // input, and rendering a partially-valid row is the one outcome worse than
    // stopping. The catch below turns it into a refusal, 🚫 never into a partial
    // view.
    found = await port.findLatest(series);
  } catch (error) {
    return {
      kind: 'refused',
      reason:
        `The stored snapshot could not be read back: ${messageOf(error)} Nothing is shown, ` +
        'because a row that failed validation is not a row AGE can report on in part.',
    };
  } finally {
    // Always released, including when the read throws.
    await port.close();
  }

  if (found === null) {
    return { kind: 'no-snapshot', reason: noSnapshotReason(trimmedBifId) };
  }

  return {
    kind: 'found',
    view: buildStoredSnapshotView(found),
    organizationId: scope.client.organizationId,
  };
}
