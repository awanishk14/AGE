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

/**
 * Source with block and line comments removed.
 *
 * ⚠️ Needed because the modules these guards scan EXPLAIN the rules they obey,
 * and an explanation that names a banned token would otherwise fail the scan.
 */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

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

  /**
   * 🛑 THE GUARD ABOVE SCANNED THE MANIFESTS ONLY, AND THE APP'S OWN SOURCE WAS
   * ITS BLIND SPOT. `AGE_STUDIO_HOST` was read in
   * `apps/studio/src/server/operator-environment.ts` and reached `main`: an
   * environment override of the bind host, which ADR-0057 D2 refuses by name
   * ("no flag, no environment override"), invisible to a scan of two JSON
   * files.
   *
   * ⚠️ The value that was read there is the value the console DISPLAYS as
   * "Bound to". An override of it is therefore not merely a configuration leak
   * — it lets the console report a host that no policy ever checked.
   */
  it('reads no bind-host override in the console source either', () => {
    // ⚠️ COMMENTS ARE STRIPPED FIRST. The module documents the defect it used
    // to carry, and naming `AGE_STUDIO_HOST` in that explanation would match
    // this scan — a file's own account of a rule must not trip the rule
    // (`vitest-worker-cap.spec.ts` carries the same note).
    const code = withoutComments(repoFile('apps/studio/src/server/operator-environment.ts'));
    expect(code).not.toMatch(/AGE_STUDIO_HOST/);
    expect(code).not.toMatch(/allowRemote/i);
    expect(code).not.toMatch(/0\.0\.0\.0/);
  });

  /**
   * ⚠️ THE POSITIVE HALF: the negative scan above is satisfied by a file that
   * reports nothing at all. The console must still derive its reported host
   * from the ONE policy, so the value on screen is a value the policy accepted.
   */
  it('derives the reported bind host from the one policy', () => {
    const text = repoFile('apps/studio/src/server/operator-environment.ts');
    expect(text).toMatch(/assertLoopbackBindHost/);
    expect(text).toMatch(/DEFAULT_STUDIO_BIND_HOST/);
  });

  /**
   * 🛑 THE THIRD PLACE THE INVARIANT CAN BE BROKEN, AND THE EASIEST ONE TO
   * BREAK BY ACCIDENT. The manifests pin the host and the source reports it —
   * but a deploy script is where somebody puts nginx "just to make the URL
   * nicer", and a reverse proxy in front of a loopback listener defeats
   * OX-INV-1 completely while every other guard here stays green.
   *
   * ⚠️ `apps/studio` has NO sign-in. Exposing it is not a convenience decision;
   * it is publishing an unauthenticated console, and it needs its own
   * `Proposed` ADR. The sanctioned route is an SSH tunnel — the ADR names it,
   * and the person at the far end has already authenticated to the host.
   */
  it('ships no deployment path that fronts, proxies or publishes the console', () => {
    const script = repoFile('scripts/deploy-studio.sh');

    // ⚠️ The script EXPLAINS which crossings it refuses, so comments are
    // stripped before the scan — the same rule as the source guard above.
    const commands = script
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

    let checked = 0;
    for (const banned of [
      /nginx/i,
      /caddy/i,
      /certbot|letsencrypt/i,
      /proxy_pass|reverse[- ]proxy/i,
      /\bufw\b|iptables|firewall-cmd/i,
      /-p\s+\d+:\d+/, // a published container port
      /0\.0\.0\.0/,
    ]) {
      expect(commands, `the deploy script must not carry ${String(banned)}`).not.toMatch(banned);
      checked += 1;
    }
    expect(checked).toBe(7);

    // ⚠️ THE POSITIVE HALF: a script that did nothing would also pass the scan
    // above. It must actually name the tunnel as the way in.
    expect(script).toMatch(/ssh -N -L 3100:127\.0\.0\.1:3100/);
  });
});
