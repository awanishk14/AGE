#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { OperatorWorkspaceRuntime } from '@age/operator-workspace';

import { handleMcpLine } from './mcp-protocol';

/**
 * The MCP server's entry point (ADR-0060 D8 item 2).
 *
 * ⚠️ THIS MODULE OWNS EVERY IMPURE THING IN THIS APP, AND NOTHING ELSE — the
 * two streams, the filesystem, the clock and the environment. It contains no
 * branch on a tool's arguments and no policy: all of that is in
 * `mcp-protocol.ts` and `mcp-tools.ts`, which are pure functions and are tested
 * as such. A guard asserts this is the only effects module in the app, because
 * absence of effects elsewhere is not enough on its own: a second module that
 * grew its own clock would leave every existing guard still passing.
 *
 * 🚫 THIS SERVER BINDS NOTHING. No port, no socket, no listener, no HTTP. MCP's
 * stdio transport is the whole point: the client starts this process and speaks
 * to it down a pipe, so there is nothing for a second party to connect to. ⚠️ A
 * network transport would make the caller-asserted `OperatorPrincipal` a caller
 * granting itself access by naming itself (ADR-0060 D5) — that is ADR-0061's
 * problem, and ADR-0061 is `Proposed`.
 *
 * 🚫 NO DATABASE IS OPENED HERE. `@prisma/client` is not a dependency of this
 * app, `assertLocalDatabaseTarget` is untouched, and no MCP exemption exists
 * (D6). ⚠️ An SSH tunnel from `localhost:5432` to a shared server is loopback
 * and is exactly what ADR-0055 D6 forbids.
 *
 * 🚫 NOTHING IS EVER WRITTEN TO `stdout` EXCEPT A JSON-RPC RESPONSE. On this
 * transport stdout IS the protocol channel: one stray log line desynchronises
 * the session and the client sees a dead server. Diagnostics go to stderr.
 */

const MCP_RUNTIME: OperatorWorkspaceRuntime = {
  env: process.env,
  /**
   * ⚠️ Used ONLY to locate the tree the operator's files must stay OUTSIDE of
   * (ADR-0054 D2) — 🚫 never to find a file. ⚠️ Unlike the console, this process
   * is started by an MCP client whose working directory is its own, so this is
   * a weaker fact here than it is there; it can only ever widen a refusal, and
   * the file path itself is still never defaulted.
   */
  repositoryRoot: () => process.cwd(),
  now: () => new Date(),
  fileExists: (path) => existsSync(path),
  readFileText: (path) => readFileSync(path, 'utf8'),
  writeFileText: (path, contents) => writeFileSync(path, contents, 'utf8'),
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
  readFileBytes: (path) => new Uint8Array(readFileSync(path)),
};

/**
 * 🛑 **ONE RESPONSE AT A TIME, IN THE ORDER THE LINES ARRIVED.**
 *
 * ⚠️ Handling a message became asynchronous when reading a source document did
 * (ADR-0070). Two overlapping handlers would write to `stdout` in whichever
 * order they happened to finish — and on this transport stdout IS the protocol
 * channel, so an out-of-order line desynchronises the session exactly as a
 * stray log line would. 🚫 Do not replace this chain with a bare `void`.
 */
let responses: Promise<void> = Promise.resolve();

async function respond(line: string): Promise<void> {
  let response;
  try {
    response = await handleMcpLine(MCP_RUNTIME, line);
  } catch (error: unknown) {
    /**
     * 🚫 NEITHER THE MESSAGE NOR THE STACK IS SENT. An unanticipated throw here
     * carries the operator's file paths and the client's own data in its framed
     * values, and this reply goes straight into a model's transcript (the
     * refusal-leak rule; `driverFailureLabelOf` exists for the same reason).
     * ⚠️ Only the error's NAME, and only on stderr.
     */
    process.stderr.write(`${error instanceof Error ? error.name : 'Unexpected failure'}\n`);
    return;
  }

  if (response !== null) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

/** Append one line to the serial chain. ⚠️ A failure never breaks the chain. */
function queue(line: string): void {
  responses = responses.then(() => respond(line));
}

function main(): void {
  let pending = '';

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk: string) => {
    pending += chunk;

    // ⚠️ Newline-delimited, and a partial line is HELD. A chunk boundary falls
    // wherever the pipe decides; parsing eagerly would reject a message that
    // simply had not finished arriving.
    let newline = pending.indexOf('\n');
    while (newline !== -1) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      queue(line);
      newline = pending.indexOf('\n');
    }
  });

  process.stdin.on('end', () => {
    // A final line without its terminator is still a message the client sent.
    if (pending.trim() !== '') {
      queue(pending);
      pending = '';
    }
  });
}

main();
