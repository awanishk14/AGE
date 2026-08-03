import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertLoopbackBindHost, DEFAULT_STUDIO_BIND_HOST } from './loopback-policy';

/**
 * OX-INV-1 enforced where it currently matters: the commands that start the
 * console.
 *
 * ⚠️ Until the console has its own server (ADR B), the bind host is decided by
 * the `next dev` / `next start` command line. A guard that only tested the
 * policy function would prove nothing about how the app is actually launched —
 * the function would be correct and unused. This guard extracts the host from
 * every start command in the repository and feeds it to the ONE policy
 * implementation. 🚫 Do not add a second copy of the rule here.
 *
 * ⚠️ Loopback is NECESSARY, NOT SUFFICIENT. A proxy, tunnel or published
 * container port in front of the listener defeats it. 🚫 Never describe this
 * guard as proving the console is unreachable.
 */

const repoFile = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8');

/** Every `next dev` / `next start` command, from wherever it is configured. */
const startCommands = (): readonly { source: string; command: string }[] => {
  const found: { source: string; command: string }[] = [];
  for (const source of ['apps/studio/package.json', 'apps/studio/project.json']) {
    const text = repoFile(source);
    for (const match of text.matchAll(/next (?:dev|start)[^"]*/g)) {
      found.push({ source, command: match[0] });
    }
  }
  return found;
};

const hostOf = (command: string): string | undefined => {
  const match = /(?:-H|--hostname)\s+(\S+)/.exec(command);
  return match?.[1];
};

describe('AGE Studio bind configuration', () => {
  it('finds the start commands at all', () => {
    // ⚠️ Assert the scan found something FIRST — an empty scan must never be
    // able to report compliance.
    expect(startCommands().length).toBeGreaterThanOrEqual(3);
  });

  it('binds every start command to a loopback host, checked by the one policy', () => {
    const commands = startCommands();
    let checked = 0;
    for (const { source, command } of commands) {
      const host = hostOf(command);
      expect(host, `${source}: "${command}" does not pin a host`).toBeDefined();
      // 🚫 The assertion is delegated, not restated. If the policy changes,
      // this guard changes with it.
      expect(assertLoopbackBindHost(host as string)).toBe(host);
      checked += 1;
    }
    expect(checked).toBe(commands.length);
  });

  it('pins the default host explicitly rather than relying on a framework default', () => {
    for (const { command } of startCommands()) {
      expect(hostOf(command)).toBe(DEFAULT_STUDIO_BIND_HOST);
    }
  });

  /**
   * 🚫 No Dockerfile. A published container port in front of a loopback
   * listener is exactly the case OX-INV-1 cannot see, and it is how `apps/web`
   * is deployed. The console is not deployed.
   */
  it('ships no Dockerfile', () => {
    expect(() => repoFile('apps/studio/Dockerfile')).toThrow();
  });

  /**
   * 🚫 No flag, no environment override, no `allowRemote`. The same reason
   * `openLocalPrismaCaptureConnection` is a separate function rather than a
   * boolean: the copy that gets relaxed still passes its own tests.
   */
  it('offers no override of the bind host', () => {
    for (const source of ['apps/studio/package.json', 'apps/studio/project.json']) {
      const text = repoFile(source);
      expect(text).not.toMatch(/allowRemote/i);
      expect(text).not.toMatch(/STUDIO_HOST|HOSTNAME=/);
      expect(text).not.toMatch(/0\.0\.0\.0/);
    }
  });
});
