import type { OperatorWorkspaceRuntime } from '@age/operator-workspace';

import { AGE_MCP_TOOLS, callAgeTool } from './mcp-tools';

/**
 * The JSON-RPC half of the MCP server, as a PURE function of one message
 * (ADR-0060 D1).
 *
 * ⚠️ AGE IS THE SERVER AND THE MODEL IS ITS CLIENT — 🚫 not the other way round.
 * No model call enters AGE here or anywhere else (D7), and this module holds no
 * socket, no stream and no clock. `src/main.ts` owns the two streams and
 * nothing else owns anything.
 *
 * WHY THE PROTOCOL IS HAND-WRITTEN RATHER THAN TAKEN FROM AN SDK. A tools-only
 * stdio server needs exactly `initialize`, `tools/list` and `tools/call` over
 * newline-delimited JSON-RPC 2.0, and writing those as a pure function makes the
 * whole surface testable in-memory — an SDK owns the transport, so testing
 * through it would mean spawning a process and would leave the refusals of D4
 * exercised by nothing. ⚠️ If this ever needs resources, prompts or sampling,
 * that is the moment to reconsider, and it is a decision, not a refactor.
 */

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_NAME = 'age';

/** JSON-RPC 2.0 error codes. Only the ones this server can actually produce. */
const METHOD_NOT_FOUND = -32601;
const INVALID_REQUEST = -32600;
const PARSE_ERROR = -32700;

export interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: string | number | null;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * The server's own description of itself.
 *
 * ⚠️ The instructions are part of the product, not decoration: they are the
 * only place a model is told, before it calls anything, that AGE's silences are
 * deliberate. 🚫 Do not soften them into a feature list.
 */
const INSTRUCTIONS = [
  'AGE answers questions about a business from evidence the operator supplied, and refuses the ones it cannot answer.',
  'A result of `not-assessed` means AGE has not looked, or could not — it is never a zero, never "none", and never a clean bill of health.',
  'A refusal names what is missing. It is not a transient failure; retrying it unchanged will refuse again.',
  'AGE performs no business execution: it sends nothing, publishes nothing, and acts on no one’s behalf.',
].join(' ');

/**
 * Handle one parsed message.
 *
 * Returns `null` for a notification — a message with no `id`, which by JSON-RPC
 * 2.0 MUST NOT be answered. ⚠️ Answering one (`notifications/initialized` is the
 * one every client sends) corrupts the stream for the rest of the session.
 */
export async function handleMcpMessage(
  runtime: OperatorWorkspaceRuntime,
  message: unknown,
): Promise<JsonRpcResponse | null> {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return fail(null, INVALID_REQUEST, 'expected a JSON-RPC 2.0 request object');
  }

  const request = message as Record<string, unknown>;
  const rawId = request.id;
  const isNotification = rawId === undefined || rawId === null;
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? rawId : null;
  const method = typeof request.method === 'string' ? request.method : undefined;

  if (method === undefined) {
    return isNotification ? null : fail(id, INVALID_REQUEST, 'no method was named');
  }

  if (isNotification) {
    return null;
  }

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        // 🚫 `tools` ONLY. AGE offers no prompts, no resources and no sampling —
        // sampling in particular would make AGE a model's caller, which D7
        // refuses outright.
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: '0.1.0' },
        instructions: INSTRUCTIONS,
      });

    case 'ping':
      return ok(id, {});

    case 'tools/list':
      return ok(id, {
        tools: AGE_MCP_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    case 'tools/call': {
      const params = (request.params ?? {}) as Record<string, unknown>;
      const name = typeof params.name === 'string' ? params.name : '';
      const args =
        typeof params.arguments === 'object' &&
        params.arguments !== null &&
        !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};

      // ⚠️ A refused tool call is a RESULT with `isError`, not a JSON-RPC error.
      // A protocol error is invisible to the model; AGE's refusals are the part
      // it most needs to read.
      return ok(id, await callAgeTool(runtime, name, args));
    }

    default:
      return fail(id, METHOD_NOT_FOUND, `this server does not implement '${method}'`);
  }
}

/**
 * Handle one line of the stdio stream.
 *
 * ⚠️ A blank line is not a message and a malformed line is not a crash: a
 * client that dies mid-write must not take AGE's session with it.
 */
export async function handleMcpLine(
  runtime: OperatorWorkspaceRuntime,
  line: string,
): Promise<JsonRpcResponse | null> {
  const trimmed = line.trim();
  if (trimmed === '') {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // 🚫 The parser's own message is not echoed — it quotes the offending text,
    // which on this transport is the operator's data (the refusal-leak rule).
    return fail(null, PARSE_ERROR, 'the line was not valid JSON');
  }

  return handleMcpMessage(runtime, parsed);
}
