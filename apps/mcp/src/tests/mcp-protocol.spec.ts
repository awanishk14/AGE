import { describe, expect, it } from 'vitest';

import { handleMcpLine, handleMcpMessage } from '../mcp-protocol';
import { AGE_MCP_TOOLS } from '../mcp-tools';
import { createInMemoryRuntime } from './in-memory-runtime';

const runtime = createInMemoryRuntime({});

async function call(method: string, params?: unknown, id: string | number = 1) {
  return await handleMcpMessage(runtime, { jsonrpc: '2.0', id, method, params });
}

describe('the handshake', () => {
  it('answers initialize with a tools-only capability set', async () => {
    // 🚫 No prompts, no resources and above all NO SAMPLING — sampling would
    // make AGE a model's caller, which ADR-0060 D7 refuses outright.
    const response = await call('initialize');
    const result = response?.result as Record<string, unknown>;

    expect(result.protocolVersion).toBe('2025-06-18');
    expect(result.capabilities).toEqual({ tools: {} });
    expect(Object.keys(result.capabilities as object)).toEqual(['tools']);
  });

  it('tells the client, before it calls anything, that AGE’s silences are deliberate', async () => {
    // ⚠️ The instructions are part of the product. 🚫 Do not soften them into a
    // feature list: they are the only place a model learns that not-assessed is
    // not a zero before it has a result in front of it.
    const instructions = String(
      ((await call('initialize'))?.result as Record<string, unknown>).instructions,
    );

    expect(instructions).toContain('not-assessed');
    expect(instructions).toContain('never a clean bill of health');
    expect(instructions).toContain('no business execution');
  });
});

describe('tools/list', () => {
  it('lists every tool with its schema', async () => {
    const tools = ((await call('tools/list'))?.result as { tools: { name: string }[] }).tools;

    expect(tools.map((tool) => tool.name)).toEqual(AGE_MCP_TOOLS.map((tool) => tool.name));
  });
});

describe('tools/call', () => {
  it('returns a refusal as a RESULT, not a JSON-RPC error', async () => {
    // ⚠️ A protocol error is invisible to the model. AGE's refusals are the
    // part it most needs to read, so they travel as content with `isError`.
    const response = await call('tools/call', { name: 'age_list_businesses', arguments: {} });

    expect(response?.error).toBeUndefined();
    expect((response?.result as { isError?: boolean }).isError).toBe(true);
  });

  it('refuses an unknown tool as a result too', async () => {
    const response = await call('tools/call', { name: 'age_execute_campaign', arguments: {} });

    expect(response?.error).toBeUndefined();
    expect((response?.result as { isError?: boolean }).isError).toBe(true);
  });
});

describe('the framing', () => {
  it('does not answer a notification', async () => {
    // ⚠️ JSON-RPC 2.0 forbids it, and every client sends
    // `notifications/initialized`. Answering it corrupts the stream for the
    // rest of the session — the failure looks like a dead server.
    expect(
      await handleMcpLine(
        runtime,
        JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      ),
    ).toBeNull();
  });

  it('ignores a blank line', async () => {
    expect(await handleMcpLine(runtime, '   ')).toBeNull();
  });

  it('survives a malformed line without echoing it back', async () => {
    // 🚫 The parser's own message quotes the offending text, which on this
    // transport is the operator's data (the refusal-leak rule).
    const response = await handleMcpLine(runtime, '{"jsonrpc": broken');

    expect(response?.error?.code).toBe(-32700);
    expect(JSON.stringify(response)).not.toContain('broken');
  });

  it('reports an unimplemented method rather than pretending to serve it', async () => {
    // 🚫 `sampling/createMessage` is the one that matters: a server that
    // answered it would be calling a model (D7).
    expect((await call('sampling/createMessage'))?.error?.code).toBe(-32601);
  });
});
