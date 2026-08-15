import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import {
  openDeployedPrismaObservationReadConnection,
  openDeployedPrismaSnapshotReadConnection,
} from '@age/capture/deployed-composition';
import {
  openDeployedPrismaSessionConnection,
  type SessionRevocation,
  type SessionStoreConnection,
} from '@age/capture/deployed-session-composition';
import { REMOTE_ACKNOWLEDGEMENT } from '@age/deployed-database-target';
import { verifyPresentedSessionToken, type SessionVerification } from '@age/session-store';
import {
  assembleEvidence as assembleEvidenceIn,
  assessCapabilityReadiness as assessCapabilityReadinessIn,
  createClientRecord as createClientRecordIn,
  generateBifFromAnswerFile as generateBifFromAnswerFileIn,
  narrowObservationRead,
  narrowSnapshotRead,
  readBusinessesView as readBusinessesViewIn,
  readClientContextProjection as readClientContextProjectionIn,
  readDerivedIntelligence as readDerivedIntelligenceIn,
  readDiscoveryDraft as readDiscoveryDraftIn,
  readRelayedObservations as readRelayedObservationsIn,
  readOperatorSourceDocument as readOperatorSourceDocumentIn,
  readSourceConfirmations as readSourceConfirmationsIn,
  recordSourceConfirmation as recordSourceConfirmationIn,
  readStoredSnapshot as readStoredSnapshotIn,
  reportContradictions as reportContradictionsIn,
  resolveBusinessScope as resolveBusinessScopeIn,
  submitDiscoveryAnswers as submitDiscoveryAnswersIn,
  writeDiscoveryDraft as writeDiscoveryDraftIn,
  type ClientContextProjectionOutcome,
  type DerivedIntelligenceOutcome,
  type OperatorWorkspaceRuntime,
  type ReadOperatorSourceDocumentOptions,
  type RecordSourceConfirmationOptions,
  type RecordSourceConfirmationOutcome,
  type RelayedObservationsOutcome,
  type SourceConfirmationsOutcome,
  type StoredSnapshotOutcome,
} from '@age/operator-workspace';
import { decodeOperatorDocument } from '@age/operator-document-decoder';
import {
  assertLoopbackBindHost,
  DEFAULT_STUDIO_BIND_HOST,
  type ClientRecordDraft,
  type DiscoveryDraft,
} from '@age/studio-shell';

/**
 * The ONE module in `apps/studio` that performs an effect.
 *
 * ⚠️ This is the `apps/capture` discipline, deliberately repeated: every
 * DECISION lives in `@age/studio-shell`, every ORCHESTRATION lives in
 * `@age/operator-workspace` (ADR-0060 D2), and every EFFECT lives here — so a
 * purity guard can assert that no other module grew its own clock, filesystem
 * read or environment lookup. 🚫 Do not read `process.env` or open a file
 * anywhere else under `src/`.
 *
 * ⚠️ THE NINE OPERATIONS ARE RE-EXPORTED WITH THEIR ORIGINAL SIGNATURES, on
 * purpose. The extraction was a MOVE: the console's screens are unchanged, and
 * their tests are what proves the move changed no behaviour.
 *
 * 🚫 Nothing here caches. A cached registry would keep serving a file the
 * operator has since corrected, and "the screen disagrees with the file" is
 * precisely the failure this console exists to make impossible.
 */

/**
 * 🛑 **THE CONSOLE'S DATABASE MAY NOT BE ON THE OPERATOR'S MACHINE** — ADR-0061
 * A5, wired by ADR-0074 §7 slice 1.
 *
 * ⚠️ **THIS IS THE ONE PLACE THE SENTENCE IS WRITTEN, AND WRITING IT IS THE
 * DECISION.** The console used to open the LOCAL doors, whose rule says the
 * target is the machine the operator is sitting at. Deployed on a VPS that
 * sentence is false while the check still passes, because loopback on a server
 * is loopback **on the server**. The deployed doors make a weaker claim that is
 * TRUE in both places: the database is reachable only over the host's own
 * loopback or a private interface, and 🚫 never a public one.
 *
 * 🚫 **IT IS NOT AN ENVIRONMENT SWITCH, ON PURPOSE.** A `if (process.env.DEPLOYED)`
 * would mean the honest rule applied exactly when somebody remembered to set a
 * variable. The console takes the claim it can always support, everywhere.
 *
 * 🚫 It authorizes nothing: where a row may live is not who may read it.
 */
const CONSOLE_DATABASE_ACKNOWLEDGEMENT = REMOTE_ACKNOWLEDGEMENT;

/**
 * The console's own effects, named once.
 *
 * 🚫 THIS IS THE ONLY `OperatorWorkspaceRuntime` IN `apps/studio`, and 🚫 it is
 * never exported. A second one would be a second place the console touches the
 * operator's machine, which is exactly what the purity guard exists to prevent.
 */
const CONSOLE_RUNTIME: OperatorWorkspaceRuntime = {
  env: process.env,

  // ⚠️ `process.cwd()` is used ONLY to locate the repository the file must be
  // OUTSIDE of — never to find the file itself. That distinction is ADR-0054
  // D2: searching the working directory for an operator's file is the refused
  // behaviour; knowing which tree to exclude is the guard that enforces it.
  repositoryRoot: () => process.cwd(),

  now: () => new Date(),
  fileExists: (path) => existsSync(path),
  readFileText: (path) => readFileSync(path, 'utf8'),

  // ⚠️ ADR-0070. A PDF read as UTF-8 is mojibake, so the decoder is handed
  // BYTES. `new Uint8Array(...)` copies out of the Buffer rather than wrapping
  // the shared pool, so nothing downstream can see another read's memory.
  readFileBytes: (path) => new Uint8Array(readFileSync(path)),
  writeFileText: (path, contents) => writeFileSync(path, contents, 'utf8'),
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
};

// ⚠️ IMPORTED, not merely re-exported — the source-confirmation wrappers below
// CALL it, and a re-export puts nothing in this module's scope.
import { refusalUnlessEntitled } from '@age/operator-workspace';

export {
  refusalUnlessEntitled,
  STUDIO_QUESTIONNAIRE,
  type BusinessScope,
  type CapabilityReadinessOutcome,
  type ClientContextProjectionOutcome,
  type ContradictionsOutcome,
  type DerivedIntelligenceOutcome,
  type CreateClientOutcome,
  type DiscoveryWorkspaceOutcome,
  type DraftOutcome,
  type StoredSnapshotOutcome,
  type EvidenceOutcome,
  type GenerateBifOutcome,
  type ReadOperatorSourceDocumentOptions,
  type RecordSourceConfirmationOptions,
  type RecordSourceConfirmationOutcome,
  type RelayedObservationsOutcome,
  type SaveOutcome,
  type SourceConfirmationsOutcome,
  type SourceDocumentOutcome,
  type SubmitOutcome,
} from '@age/operator-workspace';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * 🛑 **EVERY OPERATION THAT NAMES A BUSINESS NOW STATES WHOSE IT IS**
 * (AGE-INV-SEL-1, ADR-0074 §7 slice 3).
 *
 * `entitledOrganizationId` comes from `requireVerifiedSession()` — the ROW, 🚫
 * never a cookie, a header, a query string or a route parameter. 🚫 There is no
 * default and no optional form: a page that forgets to say whose data it wants
 * does not compile.
 *
 * ⚠️ **THE `clientId` STILL COMES OFF THE URL, AND THAT IS FINE.** It is now a
 * FILTER applied inside the entitlement, 🚫 not the thing that establishes it.
 * Naming an id the entitlement does not cover is a no-op that refuses in the
 * same words as an id that exists nowhere.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function readBusinessesView(entitledOrganizationId: string) {
  return readBusinessesViewIn(CONSOLE_RUNTIME, entitledOrganizationId);
}

export function resolveBusinessScope(entitledOrganizationId: string, clientId: string) {
  return resolveBusinessScopeIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId);
}

export function createClientRecord(draft: ClientRecordDraft) {
  return createClientRecordIn(CONSOLE_RUNTIME, draft);
}

export function readDiscoveryDraft(entitledOrganizationId: string, clientId: string) {
  return readDiscoveryDraftIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId);
}

export function writeDiscoveryDraft(
  entitledOrganizationId: string,
  clientId: string,
  draft: DiscoveryDraft,
) {
  return writeDiscoveryDraftIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId, draft);
}

export function submitDiscoveryAnswers(
  entitledOrganizationId: string,
  clientId: string,
  draft: DiscoveryDraft,
) {
  return submitDiscoveryAnswersIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId, draft);
}

export function generateBifFromAnswerFile(
  entitledOrganizationId: string,
  clientId: string,
  changedBy: string,
) {
  return generateBifFromAnswerFileIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId, changedBy);
}

export function assembleEvidence(
  entitledOrganizationId: string,
  clientId: string,
  changedBy: string,
) {
  return assembleEvidenceIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId, changedBy);
}

export function reportContradictions(
  entitledOrganizationId: string,
  clientId: string,
  changedBy: string,
) {
  return reportContradictionsIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId, changedBy);
}

export function assessCapabilityReadiness(
  entitledOrganizationId: string,
  clientId: string,
  changedBy: string,
) {
  return assessCapabilityReadinessIn(CONSOLE_RUNTIME, entitledOrganizationId, clientId, changedBy);
}

/**
 * One operator-named source document, read — and now DECODED if it is a PDF
 * (ADR-0066 D4 slice 4, extended by ADR-0070 D1/D2).
 *
 * 🛑 **THIS IS THE ONLY IMPORT OF `@age/operator-document-decoder` IN THE
 * REPOSITORY, AND IT MUST STAY THAT WAY** (ADR-0070 D1). The decoder is handed
 * to the operation as an argument rather than added to `OperatorWorkspaceRuntime`
 * — a runtime member would let `apps/mcp` bind one, and 🚫 no MCP surface is
 * authorized to decode a real client's documents.
 *
 * 🚫 **STILL NOTHING IS FETCHED.** A website URL is ADR-0059 D4.3 and a widget
 * is D4.4, both refused; OCR is refused by name in ADR-0070 D4; and DOCX has no
 * decoder because option B was DEFERRED, 🚫 not adopted. The bytes are decoded
 * in-process and 🚫 never leave this machine.
 *
 * 🚫 There is still no writer on this path, so 🚫 the answer file cannot be
 * touched from the Sources screen.
 */
export function readOperatorSourceDocument(options: ReadOperatorSourceDocumentOptions) {
  return readOperatorSourceDocumentIn(CONSOLE_RUNTIME, decodeOperatorDocument, options);
}

/**
 * The confirmations a human accepted from a source, read and recorded
 * (ADR-0073 D1).
 *
 * 🛑 **THE READ IS WHAT MAKES THE ACCUMULATION REAL.** `recordSourceConfirmation`
 * loads what is on DISK before recording, so the next confirmation is added to
 * every earlier one rather than to an empty draft — the defect ADR-0073 exists to
 * fix. 🚫 It writes ONE file in the operator's own workspace, 🚫 never the answer
 * file, and 🚫 nothing reaches a database, AGE or a peer.
 */
export function readSourceConfirmations(
  entitledOrganizationId: string,
  clientId: string,
): SourceConfirmationsOutcome {
  // 🛑 GATED HERE, 🚫 not inside `@age/operator-workspace`'s draft module —
  // gating it there would make `operator-workspace.ts` import the module that
  // imports it. The gate is the SAME function the workspace operations use, so
  // there is still exactly one implementation of the rule.
  const unentitled = refusalUnlessEntitled(CONSOLE_RUNTIME, entitledOrganizationId, clientId);
  if (unentitled !== undefined) return unentitled;

  return readSourceConfirmationsIn(CONSOLE_RUNTIME, clientId);
}

export function recordSourceConfirmation(
  entitledOrganizationId: string,
  clientId: string,
  options: RecordSourceConfirmationOptions,
): RecordSourceConfirmationOutcome {
  // ⚠️ THE WRITE DOOR, GATED TOO. A gate on the read alone would leave a caller
  // unable to see another organization's confirmations and still able to append
  // to them.
  const unentitled = refusalUnlessEntitled(CONSOLE_RUNTIME, entitledOrganizationId, clientId);
  if (unentitled !== undefined) return unentitled;

  return recordSourceConfirmationIn(CONSOLE_RUNTIME, clientId, options);
}

/**
 * The stored row, read back (ADR-0064 D1).
 *
 * ⚠️ THE ONLY PLACE `apps/studio` REACHES THE SNAPSHOT STORE, and it reaches it
 * through the ADR-0055 D2 read façade rather than a repository, a Prisma client
 * or `@age/persistence`. The façade binds out two reads and a close; the
 * repository never escapes the function that built it, so there is no append
 * path here to take.
 *
 * 🚫 NARROWED FURTHER, on purpose. `narrowSnapshotRead` drops
 * `findBySnapshotId` before the port leaves this module: addressing a snapshot
 * by id is how a surface begins comparing two of them, and cross-snapshot
 * reading is ADR-0055 §5 item 1 — recorded, NOT authorized.
 *
 * ⚠️ THE CONNECTION IS OPENED LAZILY, inside a thunk. The operation resolves
 * the business FIRST and only calls this when there is a scope to read under, so
 * an unknown business never opens a database connection.
 *
 * 🚫 READ-ONLY, AND NOT MERELY BY CONVENTION (ADR-0064 D2). Nothing here writes
 * a row, and 🛑 no screen may seed one to make this panel look populated.
 */
export function readStoredSnapshot(
  entitledOrganizationId: string,
  clientId: string,
  bifId: string,
): Promise<StoredSnapshotOutcome> {
  return readStoredSnapshotIn(
    CONSOLE_RUNTIME,
    () =>
      narrowSnapshotRead(
        openDeployedPrismaSnapshotReadConnection({
          acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
        }),
      ),
    entitledOrganizationId,
    clientId,
    bifId,
  );
}

/**
 * 🛑 **THE ORGANIZATION THIS DEPLOYMENT LOOKS SESSIONS UP IN — ADR-0074 §7 slice
 * 2, and the one decision in this slice that ADR-0074 did not settle.**
 *
 * ⚠️ **THE PROBLEM, PLAINLY.** ADR-0074 D5 says the session establishes the
 * organization *"from the ROW, never from the cookie, never from a header, never
 * from the URL"*. But the row lives behind `FORCE ROW LEVEL SECURITY`, whose
 * policy compares `organization_id` to a transaction-local setting — so
 * something has to name an organization BEFORE the row can be read, and the row
 * is what was going to name it. ADR-0068 refuses to default that scope, for the
 * right reason: an unscoped lookup matches zero rows, and a false refusal is
 * indistinguishable from a bad credential.
 *
 * ⚠️ **THE RESOLUTION, AND WHY IT DOES NOT WEAKEN D5.** The deployment names its
 * own organization, out of band, in the same root-owned `mode 0600`
 * `EnvironmentFile` that carries `DATABASE_URL_APP`. It is used for **ONE
 * PURPOSE ONLY: the RLS lookup scope**, which is COHERENCE and 🚫 never
 * authorization (ADR-0046 D5). 🛑 **EVERY ENTITLEMENT DECISION STILL READS
 * `session.organizationId` OFF THE ROW**, and `readWithinEntitlement` re-derives
 * the query scope from that and nothing else.
 *
 * Why this is safe rather than a loophole:
 *
 *   - It can only NARROW. A row whose `organization_id` does not match is
 *     invisible, so naming the wrong organization verifies nothing. 🚫 It cannot
 *     admit anyone; it can only fail to admit someone.
 *   - 🚫 It is not a caller claim. It arrives from a root-owned file on the host,
 *     never from a cookie, a header, a form field or a URL — the four sources D5
 *     names. Anyone able to edit that file already owns the machine.
 *   - 🚫 It builds no second organization concept. It is a string handed to
 *     `set_config`, and nothing downstream reads it.
 *
 * ⚠️ **AN ABSENT VALUE REFUSES, 🚫 IT DOES NOT DEFAULT.** A deployment that
 * cannot say which tenant it serves must admit nobody — and it must SAY SO, by
 * naming the VARIABLE, so the operator sees a misconfiguration rather than a
 * credential that looks broken. 🚫 The refusal never carries the value.
 *
 * 🛑 **THIS IS A SINGLE-ORGANIZATION DEPLOYMENT AND IT IS A DECISION, NOT A GAP.**
 * ADR-0074 authorizes a CLIENT switcher over ONE entitled organization; a second
 * organization on one host would need its own ADR, and 🚫 must not be reached for
 * by turning this into a list.
 */
export function sessionLookupOrganizationId(): string | undefined {
  const raw = process.env.AGE_STUDIO_ORGANIZATION_ID;

  return raw === undefined || raw.trim() === '' ? undefined : raw.trim();
}

/**
 * The session door, opened for exactly one operation and closed again.
 *
 * ⚠️ **NOTHING HOLDS IT OPEN, AND THAT IS THE SAME RULE AS EVERY OTHER READ HERE
 * (ADR-0055 D2).** A module-level connection is a reference a screen could
 * acquire; a connection opened and closed inside one call is not.
 *
 * 🚫 **NEITHER FUNCTION IS AN AUTHORIZATION.** `verifySessionToken` answers *is
 * there a live row for this digest, in this deployment's scope*, and
 * `revokeSessionById` ends one. What the resulting session may act on is
 * `askEntitlement`, always, afterwards.
 */
async function withSessionStore<T>(
  operation: (store: SessionStoreConnection) => Promise<T>,
): Promise<T> {
  const store = openDeployedPrismaSessionConnection({
    acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
  });

  try {
    return await operation(store);
  } finally {
    await store.close();
  }
}

/**
 * Verifies a presented token against the store.
 *
 * ⚠️ **THE HASHING HAPPENS INSIDE `verifyPresentedSessionToken`**, which is the
 * ONE implementation of that rule. The digest is what reaches the database, so a
 * query log or a slow-query trace cannot capture the credential.
 *
 * ⚠️ **IT DOES NOT THROW FOR AN ORDINARY FAILURE.** A wrong token is a RESULT,
 * not an exception — the five unverified reasons stay five, and a caller can
 * tell `expired` from `revoked` from `no-such-session`.
 */
export function verifySessionToken(
  presentedToken: string,
  organizationId: string,
): Promise<SessionVerification> {
  return withSessionStore((store) =>
    verifyPresentedSessionToken({
      presentedToken,
      findRowByTokenHash: (tokenHash) => store.findByTokenHash(organizationId, tokenHash),
      now: new Date(),
    }),
  );
}

/**
 * Ends one session, server-side.
 *
 * 🛑 **THIS IS WHAT MAKES A LOGOUT A LOGOUT** (ADR-0074 D3). Clearing the cookie
 * discards the operator's copy of the token; this discards the token. 🚫 The two
 * are not interchangeable and the cookie half must never be shipped alone.
 */
export function revokeSessionById(
  organizationId: string,
  sessionId: string,
): Promise<SessionRevocation> {
  return withSessionStore((store) =>
    store.revoke(organizationId, sessionId, new Date().toISOString()),
  );
}

/**
 * The host the console is CONFIGURED to bind. 🚫 Not the socket it actually
 * bound — nothing here can observe that, and this function must never be
 * described as if it could.
 *
 * 🛑 THIS READ `process.env.AGE_STUDIO_HOST ?? '127.0.0.1'` AND THAT WAS A
 * DEFECT ON `main`, in two compounding ways:
 *
 *   1. It was an **environment override of the bind host**, which ADR-0057 D2
 *      refuses by name ("no flag, no environment override"). The guard that
 *      enforces D2 scanned `package.json` and `project.json` only, so an env
 *      read in this file was its blind spot and reached `main` unseen.
 *   2. The value is what the console DISPLAYS as "Bound to". An unchecked
 *      override therefore let the console **report a host no policy had
 *      accepted** — and the System Status detail beside it asserted a refusal
 *      that no code performed.
 *
 * ⚠️ It is now derived from the ONE policy: the same pinned constant the start
 * commands use, passed through the same assertion that guards them. 🚫 Do not
 * reintroduce a parameter, a flag or an environment read here — a reported
 * value that the policy never saw is the whole defect.
 */
export function boundHost(): string {
  return assertLoopbackBindHost(DEFAULT_STUDIO_BIND_HOST);
}

/** The port the console was started on. */
export function boundPort(): number {
  const raw = process.env.PORT ?? process.env.AGE_STUDIO_PORT;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3100;
}

/**
 * What peer products have OBSERVED, read back (ADR-0069 deliverable 6).
 *
 * ⚠️ THE ONLY PLACE `apps/studio` REACHES THE OBSERVATION STORE, and it reaches
 * it through a façade carrying one read and a close. `narrowObservationRead`
 * rebinds those two before the port leaves this module, so 🚫 no screen holds a
 * reference that could relay an observation — the relay is a separate act, on a
 * separate path, with its own gate (ADR-0069 D3).
 *
 * ⚠️ THE CONNECTION IS OPENED LAZILY, inside a thunk: the operation resolves the
 * business FIRST and only calls this when there is a scope to read under, so an
 * unknown business never opens a database connection.
 *
 * 🛑 AN EMPTY ANSWER IS A NAMED STATE, never an empty panel — and 🚫 no screen
 * may seed a row to make this look populated (ADR-0064 D2).
 */
export function readRelayedObservations(
  entitledOrganizationId: string,
  clientId: string,
): Promise<RelayedObservationsOutcome> {
  return readRelayedObservationsIn(
    CONSOLE_RUNTIME,
    () =>
      narrowObservationRead(
        openDeployedPrismaObservationReadConnection({
          acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
        }),
      ),
    entitledOrganizationId,
    clientId,
  );
}

/**
 * What AGE CONCLUDES, read back (ADR-0069 deliverable 6c-2).
 *
 * 🛑 **THE ONLY OPERATION THAT OPENS TWO CONNECTIONS**, and both are thunks, so
 * the ORDER is enforced by the orchestration rather than promised here: an
 * unknown business opens neither, and a business AGE holds no context for opens
 * only the first. ⚠️ The second thunk is not called at all when there is no
 * stored context — "AGE never ran the derivation" must not cost a read of the
 * observation store, because a screen that reached it would be one refactor
 * away from rendering "nothing concluded" over a business AGE cannot model.
 *
 * 🚫 BOTH FAÇADES ARE THE NARROWED ONES. Neither carries an append, and this is
 * the read path — 🛑 relaying an observation is a separate act on a separate
 * path (ADR-0069 D3), and it does not become reachable by being adjacent.
 *
 * 🚫 NOTHING IS PERSISTED (D2): the projection is recomputed on every request,
 * and 🚫 no screen may seed a row to make it look populated (ADR-0064 D2).
 */
export function readDerivedIntelligence(
  entitledOrganizationId: string,
  clientId: string,
  bifId: string,
): Promise<DerivedIntelligenceOutcome> {
  return readDerivedIntelligenceIn(
    CONSOLE_RUNTIME,
    () =>
      narrowSnapshotRead(
        openDeployedPrismaSnapshotReadConnection({
          acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
        }),
      ),
    () =>
      narrowObservationRead(
        openDeployedPrismaObservationReadConnection({
          acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
        }),
      ),
    entitledOrganizationId,
    clientId,
    bifId,
  );
}

/**
 * What AGE WOULD TELL A PEER about this business (ADR-0069 deliverable 7).
 *
 * 🛑 **ONE STORE, AND ONLY ONE.** Exactly one thunk is handed over, and it is
 * the snapshot read. The observation store is not opened, not passed and not
 * reachable from here — 🚫 and it must not become so: mixing in what a source
 * reported would turn a statement about AGE's own model into a statement about
 * what the world has said, which is the category confusion the three-way
 * separation exists to prevent.
 *
 * ⚠️ THE CONNECTION IS OPENED LAZILY, inside the thunk, so an unknown business
 * and a blank BIF id both cost nothing and reach nothing.
 *
 * 🚫 THE FAÇADE IS THE NARROWED ONE — a read and a close, no `append` — and this
 * is a read path. 🛑 Serving a peer is a different act on a different surface,
 * and it does not become reachable by being adjacent to this one.
 */
export function readClientContextProjection(
  entitledOrganizationId: string,
  clientId: string,
  bifId: string,
): Promise<ClientContextProjectionOutcome> {
  return readClientContextProjectionIn(
    CONSOLE_RUNTIME,
    () =>
      narrowSnapshotRead(
        openDeployedPrismaSnapshotReadConnection({
          acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
        }),
      ),
    entitledOrganizationId,
    clientId,
    bifId,
  );
}
