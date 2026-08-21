import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import {
  openDeployedPrismaObservationReadConnection,
  openDeployedPrismaSnapshotReadConnection,
} from '@age/capture/deployed-composition';
import {
  openDeployedPrismaSessionConnection,
  type SessionRevocation,
  type SessionStoreConnection,
} from '@age/capture/deployed-session-composition';
import {
  openDeployedPrismaScopeConnection,
  type ScopeStoreConnection,
} from '@age/capture/deployed-scope-composition';
import {
  openDeployedPrismaSignInConnection,
  type IssuedSession,
  type SignInStoreConnection,
} from '@age/capture/deployed-sign-in-composition';
import { GOOGLE_TOKEN_ENDPOINT } from '@age/google-sign-in';
import { REMOTE_ACKNOWLEDGEMENT } from '@age/deployed-database-target';
import { verifyPresentedSessionToken, type SessionVerification } from '@age/session-store';
import { ISSUED_SESSION_LIFETIME_SECONDS } from '@age/session-store';
import type { DirectoryEntry } from '@age/sign-in-directory';
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
  assertConsoleBindHost,
  type ConsoleListenerBoundary,
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
 * One organization this deployment serves — ADR-0085, named in ADR-0086.
 *
 * ⚠️ **TWO FIELDS THAT ARE 🚫 NOT INTERCHANGEABLE.** `id` is the scope: it is
 * what a choice is compared against, what a session carries, and what every row
 * is filed under. `displayName` is what a person reads. 🚫 A caller that
 * compares the name has written a bug the type cannot catch, which is why there
 * is a guard for it rather than only a comment.
 */
export interface ServedOrganization {
  readonly id: string;
  readonly displayName: string | undefined;
}

/**
 * **THE ORGANIZATIONS THIS CONSOLE SERVES** — ADR-0085.
 *
 * 🛑 **IT IS A LIST BECAUSE THE PICKER MUST NOT HAVE A DEFAULT, 🚫 NOT BECAUSE
 * THE DEPLOYMENT IS MULTI-TENANT.** The note above still holds: one host serves
 * one organization, and a second would need its own ADR. What this shape buys
 * is that the caller has to CHOOSE from it — `organizations[0]` is a line
 * somebody has to write on purpose, where `?? lookupOrganizationId` was a line
 * somebody could write by accident (ADR-0082 D4).
 *
 * 🛑 **THIS IS THE CLOSED SET A CHOICE IS CHECKED AGAINST.** It comes from the
 * root-owned host file, 🚫 never from a cookie, a header, a form field or a URL
 * — so a forged choice names something that is not in it and is discarded.
 * ⚠️ An unconfigured deployment serves NOTHING, and an empty list admits
 * nobody: it does 🚫 not fall back.
 *
 * 🛑 **THE `id` IS THE SCOPE. THE `displayName` IS TEXT** (ADR-0086). Every
 * comparison in this product is against `id`; the name exists so an operator
 * reads "Digital Dadi" instead of a machine identifier, and 🚫 nothing routes,
 * files or admits on it.
 */
export function organizationsThisConsoleServes(): readonly ServedOrganization[] {
  const configured = sessionLookupOrganizationId();

  if (configured === undefined) return Object.freeze([]);

  return Object.freeze([Object.freeze({ id: configured, displayName: organizationDisplayName() })]);
}

/**
 * **THE LABEL A HOST PUTS ON THE ORGANIZATION IT SERVES** — ADR-0086.
 *
 * 🛑 **A LABEL, 🚫 NOT AN IDENTIFIER.** It is rendered and nothing else: 🚫 never
 * compared, 🚫 never stored on a row, 🚫 never a key, and 🚫 never the value a
 * choice is checked against — that is `id`, always. A display name that could
 * admit somebody would be a second, prettier identifier, and two identifiers for
 * one organization is exactly the shape AGE-INV-PROV-1 refuses.
 *
 * ⚠️ **ABSENT IS NOT BLANK, AND 🚫 NOT INVENTED.** An unnamed organization
 * renders as its `id` — the honest answer, because the id IS what this
 * deployment knows. 🚫 It is never prettified, title-cased or guessed at from
 * the id; a name AGE made up would be a fact nobody stated.
 */
function organizationDisplayName(): string | undefined {
  const raw = process.env.AGE_STUDIO_ORGANIZATION_NAME;

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
      // 🛑 **THE ONE COMPOSED READER, AND THE TWO CHANNELS ARE 🚫 NOT MERGED
      // ANYWHERE ELSE** (ADR-0083 D5). Two reads, two fences, one after the
      // other: the tenant policy compares an organization, the platform policy
      // compares this digest against `organization_id IS NULL`. 🚫 Neither can
      // return the other's row, so the order is not a precedence — at most one
      // of them can answer at all.
      //
      // ⚠️ **`?? await` AND 🚫 NOT `||`.** A row is an object; the falsy
      // values here are `null` and `undefined` alone, and a `||` would re-ask
      // the second question about a row that legitimately came back empty in
      // some other sense.
      findRowByTokenHash: async (tokenHash) =>
        (await store.findByTokenHash(organizationId, tokenHash)) ??
        (await store.findPlatformByTokenHash(tokenHash)),
      now: new Date(),
    }),
  );
}

/**
 * Ends one PLATFORM session — ADR-0083 D5.
 *
 * 🛑 **THE DIGEST IS THE SCOPE, 🚫 NOT A SECOND IDENTIFIER OF THE ROW.** A
 * platform session has no organization to be narrowed by, so the transaction is
 * fenced on the digest the request is already presenting — which means 🚫 a
 * caller cannot end a session it is not holding, and 🚫 cannot end a set.
 *
 * ⚠️ **IT IS THE SAME `updateMany` AND THE SAME TWO OUTCOMES** (ADR-0083 D3).
 * 🚫 Revocation did not acquire a second implementation; the SCOPE did.
 */
export function revokePlatformSessionByDigest(
  presentedTokenHash: string,
  sessionId: string,
): Promise<SessionRevocation> {
  return withSessionStore((store) =>
    store.revokePlatform(presentedTokenHash, sessionId, new Date().toISOString()),
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
  return assertConsoleBindHost(
    consoleBoundary() === 'loopback-published-container' ? '0.0.0.0' : DEFAULT_STUDIO_BIND_HOST,
    consoleBoundary(),
  );
}

/**
 * Which boundary the console is actually running behind (ADR-0076 D2).
 *
 * 🛑 **A FILESYSTEM OBSERVATION, 🚫 NOT A CONFIGURATION READ.** `/.dockerenv` is
 * written by the container runtime; there is deliberately no environment
 * variable, flag or parameter here, because the one thing this function must
 * never become is a way to SELECT a boundary.
 *
 * ⚠️ **ITS LIMIT, STATED PLAINLY:** it reports where the process believes it is
 * running, which is what the console DISPLAYS. It does 🚫 not decide the bind —
 * the start command does that (`start` vs `start:container`). If the two ever
 * disagreed, the screen would be wrong and the boundary would not change; that
 * is the harmless direction, and it is why this is not an authorization input.
 */
function consoleBoundary(): ConsoleListenerBoundary {
  return existsSync('/.dockerenv') ? 'loopback-published-container' : 'host-loopback';
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

/**
 * ────────────────────────────────────────────────────────────────────────────
 * 🛑 **SIGN-IN'S EFFECTS — ADR-0079 §6 slice 3.**
 *
 * Four kinds of effect arrive with sign-in, and every one of them lands HERE
 * rather than in a route: RANDOMNESS (the session token and the two handshake
 * values), the NETWORK (one POST to Google's token endpoint), the ENVIRONMENT
 * (the OAuth client), and the ONE authorized INSERT.
 *
 * 🚫 **THE PURE PACKAGES GAINED NONE OF THEM.** `@age/google-sign-in` builds a
 * URL and reads claims; `@age/sign-in-directory` decides admission;
 * `@age/session-store` computes the expiry and hashes the token. Not one of them
 * can mint, fetch, read a clock or open a connection — which is why a test can
 * drive every decision in sign-in without a network and without a database.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * The OAuth client this deployment signs in with.
 *
 * 🛑 **AN ABSENT VALUE REFUSES AND 🚫 DOES NOT DEFAULT**, exactly as
 * `sessionLookupOrganizationId` refuses: a console that cannot say who it is to
 * Google must admit nobody, and it must SAY SO by naming the VARIABLE, so the
 * operator sees a misconfiguration rather than a sign-in that looks broken.
 *
 * 🚫 **A REFUSAL NAMES THE VARIABLE AND 🚫 NEVER THE VALUE.** One of these three
 * is a client SECRET; a refusal that echoed it would put it in a log, a
 * screenshot and a support message.
 *
 * ⚠️ **THE REDIRECT URI IS CONFIGURED, 🚫 NOT DERIVED FROM THE REQUEST.**
 * `request.url` is built from a header the caller controls, and a redirect URI
 * derived from one would be a Host-header injection primitive on the single
 * route an unauthenticated caller on the public internet can reach — the exact
 * defect measured on this deployment and fixed in the submit route. It must also
 * match Google's registered value BYTE FOR BYTE, and a value assembled from a
 * header cannot promise that.
 */
export interface GoogleSignInConfiguration {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export const GOOGLE_SIGN_IN_SETTINGS = [
  'AGE_STUDIO_GOOGLE_CLIENT_ID',
  'AGE_STUDIO_GOOGLE_CLIENT_SECRET',
  'AGE_STUDIO_GOOGLE_REDIRECT_URI',
] as const;

export function googleSignInConfiguration(): GoogleSignInConfiguration | undefined {
  const [clientId, clientSecret, redirectUri] = GOOGLE_SIGN_IN_SETTINGS.map(readRequiredSetting);

  if (clientId === undefined || clientSecret === undefined || redirectUri === undefined) {
    return undefined;
  }

  return { clientId, clientSecret, redirectUri };
}

/** ⚠️ Blank is ABSENT, 🚫 not a value — an empty `.env` line is a misconfiguration. */
function readRequiredSetting(name: string): string | undefined {
  const raw = process.env[name];

  return raw === undefined || raw.trim() === '' ? undefined : raw.trim();
}

/**
 * 32 bytes of cryptographic randomness, as hex.
 *
 * 🛑 **`randomBytes`, 🚫 NEVER `Math.random`.** The value this mints IS the
 * session — a predictable one is a session anybody can present — and it is also
 * the `state` that makes the callback unforgeable.
 *
 * ⚠️ **ONE MINT FOR ALL THREE VALUES, ON PURPOSE.** The token, the `state` and
 * the `nonce` want exactly the same property, and three functions would be three
 * places for one of them to quietly become weaker than the others.
 */
export function mintOpaqueValue(): string {
  return randomBytes(32).toString('hex');
}

/**
 * The instant sign-in is happening.
 *
 * ⚠️ Named separately from `CONSOLE_RUNTIME.now` only because the routes do not
 * hold the runtime — 🚫 it is the same `new Date()`, not a second notion of time.
 */
export function signInNow(): Date {
  return new Date();
}

/**
 * 🛑 **THE ONLY OUTBOUND REQUEST AGE MAKES, AND ITS EXACT WIDTH.**
 *
 * One POST, to a CONSTANT URL — `GOOGLE_TOKEN_ENDPOINT`, a compile-time string
 * from `@age/google-sign-in`, 🚫 never a value from a response, a claim, a
 * discovery document or the environment. ⚠️ **THIS IS NOT AN OUTBOUND WRITE
 * SURFACE** (ADR-0057 D4 class 3): AGE sends a code it has just received back to
 * the issuer that minted it, and receives an identity. 🚫 It publishes nothing,
 * relays nothing, and tells Google nothing about any client.
 *
 * 🚫 **NO URL FETCHING RETURNS BY THIS DOOR.** A caller cannot name a host, and
 * there is no parameter here through which one could be introduced.
 *
 * ⚠️ **IT RETURNS THE RAW ID TOKEN AND JUDGES NOTHING.** Whether the claims are
 * believable is `verifiedGoogleIdentity`'s answer, in a pure package, always.
 * `undefined` covers every network failure, every non-200 and every response
 * without a usable `id_token` — 🚫 they are deliberately not distinguished,
 * because to an unauthenticated caller they must not be, and 🚫 the body is never
 * logged: it carries a credential.
 */
export async function exchangeGoogleAuthorizationCode(
  configuration: GoogleSignInConfiguration,
  code: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        redirect_uri: configuration.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!response.ok) return undefined;

    const payload: unknown = await response.json();

    if (typeof payload !== 'object' || payload === null) return undefined;

    const idToken = (payload as Record<string, unknown>)['id_token'];

    return typeof idToken === 'string' && idToken !== '' ? idToken : undefined;
  } catch {
    // ⚠️ A network failure is a REFUSED sign-in, 🚫 not a 500 from the one route
    // an unauthenticated caller on the public internet can reach.
    return undefined;
  }
}

/**
 * The scope door, opened for exactly one read and closed again - ADR-0079 §6
 * slice 4.
 *
 * 🛑 **IT IS A DIFFERENT DOOR FROM THE SIGN-IN ONE, ON PURPOSE.** The sign-in
 * door can INSERT a session; this read happens on EVERY request, and 🚫 a
 * per-request read must not travel through a door that can mint a credential.
 * The composition root next door carries the whole claim.
 *
 * ⚠️ **NOTHING HOLDS IT OPEN** - the same rule as every other read here
 * (ADR-0055 D2).
 */
async function withScopeStore<T>(
  operation: (store: ScopeStoreConnection) => Promise<T>,
): Promise<T> {
  const store = openDeployedPrismaScopeConnection({
    acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
  });

  try {
    return await operation(store);
  } finally {
    await store.close();
  }
}

/**
 * What this signed-in account may still reach, read fresh.
 *
 * 🛑 **READ ON EVERY REQUEST, 🚫 NEVER FROM A TOKEN CLAIM** (ADR-0079 §2
 * property 2). AGE already re-checks `revokedAt` on every request; this makes
 * the MEMBERSHIP agree with it, so a demoted, revoked or disabled operator loses
 * their reach on the next request rather than at token expiry.
 *
 * 🚫 **IT DECIDES NOTHING.** `decideSignIn` reasons over these rows - the same
 * decision sign-in took, 🚫 not a second gentler copy of it.
 */
export function readDirectoryEntryByAccount(
  organizationId: string,
  accountId: string,
): Promise<DirectoryEntry> {
  return withScopeStore((store) => store.findDirectoryEntryByAccount(organizationId, accountId));
}

/**
 * Whether this signed-in PLATFORM account still holds a live platform
 * membership — ADR-0089, and the thing that makes _"read on every request"_ true
 * on the platform arm as well as the tenant one.
 *
 * 🛑 **IT GOES THROUGH THE SCOPE DOOR, 🚫 NOT THE SIGN-IN DOOR.** Its
 * address-keyed sibling above lives on the sign-in door because sign-in is when
 * an address exists; this one runs on EVERY request, and 🚫 a per-request read
 * must not travel through a door that can mint a credential.
 *
 * 🛑 **IT IS FENCED BY THE PROVED ACCOUNT, 🚫 UNSCOPED.** One account id — the
 * one the session already proved — and 🚫 there is no parameter through which an
 * organization could be supplied. ⚠️ Passing the pinned organization "to make
 * the re-read work" is the ADR-0082 D4 substitution; here it is not merely
 * forbidden, it is **unrepresentable**.
 *
 * 🚫 **IT DECIDES NOTHING.** `decideSignIn(entry, null)` reasons over these rows
 * — the SAME decision sign-in took, 🚫 not a gentler copy of it.
 */
export function readPlatformDirectoryEntryByAccount(accountId: string): Promise<DirectoryEntry> {
  return withScopeStore((store) => store.findPlatformDirectoryEntryByAccount(accountId));
}

/**
 * The sign-in door, opened for exactly one operation and closed again.
 *
 * ⚠️ **NOTHING HOLDS IT OPEN** — the same rule as every other read here
 * (ADR-0055 D2). A module-level connection is a reference a screen could
 * acquire; one opened and closed inside a call is not.
 */
async function withSignInStore<T>(
  operation: (store: SignInStoreConnection) => Promise<T>,
): Promise<T> {
  const store = openDeployedPrismaSignInConnection({
    acknowledgedRemote: CONSOLE_DATABASE_ACKNOWLEDGEMENT,
  });

  try {
    return await operation(store);
  } finally {
    await store.close();
  }
}

/**
 * Who this address is, inside this deployment's organization.
 *
 * 🚫 **IT DECIDES NOTHING.** Admission is `decideSignIn`'s answer, in a pure
 * package, afterwards — this door only fetches the rows that decision reasons
 * over.
 */
export function readSignInDirectoryEntry(
  organizationId: string,
  email: string,
): Promise<DirectoryEntry> {
  return withSignInStore((store) => store.findDirectoryEntry(organizationId, email));
}

/**
 * Whether this Google-verified address is a PLATFORM operator — ADR-0080
 * Option A, reached from exactly one caller.
 *
 * 🛑 **IT IS FENCED BY THE ADDRESS, 🚫 NOT UNSCOPED.** The database answers one
 * question about one address the caller already holds. 🚫 It cannot enumerate,
 * and 🚫 there is no parameter through which a tenant could be supplied — so
 * this read can neither be pointed at an organization nor accidentally return
 * one's people.
 *
 * 🚫 **IT DECIDES NOTHING**, exactly like the scoped read next door.
 */
export function readPlatformDirectoryEntry(email: string): Promise<DirectoryEntry> {
  return withSignInStore((store) => store.findPlatformDirectoryEntry(email));
}

/**
 * 🛑 **THE ONE ACT IN AGE THAT CREATES A CREDENTIAL, AND ITS EXACT WIDTH.**
 *
 * It writes ONE `operator_sessions` row for an account that ALREADY EXISTS.
 * 🚫 It cannot create an account, cannot create a membership, cannot grant a role
 * and cannot change what any of them mean — `accounts` and `account_memberships`
 * hold `GRANT SELECT` and nothing else. **AGE MINTS NOTHING** is unchanged in
 * every sense except the one ADR-0079 §3 named.
 *
 * ⚠️ **THE LIFETIME IS THE CONSTANT, 🚫 NOT A PARAMETER.** Eight hours, ADR-0079
 * D4, the owner's answer, the same for every scope. A caller that could choose it
 * would be a caller that could choose the ceiling.
 */
export function issueOperatorSession(
  organizationId: string,
  accountId: string,
  token: string,
  issuedAt: Date,
): Promise<IssuedSession> {
  return withSignInStore((store) =>
    store.issue(organizationId, {
      sessionId: mintOpaqueValue(),
      organizationId,
      accountId,
      token,
      issuedAt,
      lifetimeSeconds: ISSUED_SESSION_LIFETIME_SECONDS,
    }),
  );
}

/**
 * 🛑 **THE SAME ONE ACT, FOR A PRINCIPAL THAT HAS NO ORGANIZATION** — ADR-0083
 * D5.
 *
 * ⚠️ **THERE IS NO ORGANIZATION PARAMETER, AND THAT IS THE POINT.** The
 * dangerous version of this function takes one and passes the deployment's
 * pinned tenant, which would file a platform operator's session under a tenant
 * they never named — 🚫 exactly the substitution ADR-0082 D4 forbids. A
 * parameter that does not exist cannot be filled in by mistake.
 *
 * ⚠️ **THE LIFETIME IS THE SAME CONSTANT** — eight hours, ADR-0079 D4, the
 * owner's answer, the same for every scope.
 */
export function issuePlatformSession(
  accountId: string,
  token: string,
  issuedAt: Date,
): Promise<IssuedSession> {
  return withSignInStore((store) =>
    store.issuePlatform({
      sessionId: mintOpaqueValue(),
      accountId,
      token,
      issuedAt,
      lifetimeSeconds: ISSUED_SESSION_LIFETIME_SECONDS,
    }),
  );
}
