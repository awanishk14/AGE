import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  assertConsoleBindHost,
  assertLoopbackBindHost,
  type ConsoleListenerBoundary,
  DEFAULT_STUDIO_BIND_HOST,
} from './loopback-policy';

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

/**
 * Every `next dev` / `next start` command, from wherever it is configured.
 *
 * ⚠️ The KEY the command is configured under travels with it. ADR-0076 D2 gives
 * exactly one command a different boundary, and the only honest way to know
 * WHICH command a matched string is, is to capture the name it was declared
 * under — 🚫 never to read the host back out of the command and let the command
 * decide its own rule.
 */
const startCommands = (): readonly { source: string; key: string; command: string }[] => {
  const found: { source: string; key: string; command: string }[] = [];
  for (const source of ['apps/studio/package.json', 'apps/studio/project.json']) {
    const text = repoFile(source);
    for (const match of text.matchAll(/"([^"]+)"\s*:\s*"(next (?:dev|start)[^"]*)"/g)) {
      found.push({ source, key: match[1] as string, command: match[2] as string });
    }
  }
  return found;
};

/**
 * The boundary a start command is declared for — from its NAME, 🚫 never from an
 * environment variable and 🚫 never from the host it happens to carry.
 */
const boundaryOf = (key: string): ConsoleListenerBoundary =>
  key === 'start:container' ? 'loopback-published-container' : 'host-loopback';

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

  /**
   * ⚠️ ADR-0076 D2 amended the invariant; it did not fork it. The host boundary
   * must still be THE SAME RULE, so a relaxation of `assertLoopbackBindHost`
   * cannot hide behind the new entry point — and 🚫 a container boundary must
   * never quietly accept a loopback host, which would make the console
   * unreachable from the proxy while every guard here stayed green.
   */
  it('keeps the host boundary delegated to the one loopback policy', () => {
    expect(assertConsoleBindHost('127.0.0.1', 'host-loopback')).toBe(
      assertLoopbackBindHost('127.0.0.1'),
    );
    expect(() => assertConsoleBindHost('0.0.0.0', 'host-loopback')).toThrow(/not loopback/);
    expect(() => assertConsoleBindHost('127.0.0.1', 'loopback-published-container')).toThrow(
      /must be 0\.0\.0\.0/,
    );
  });

  it('binds every start command to a host the ONE policy accepts for its boundary', () => {
    const commands = startCommands();
    let checked = 0;
    for (const { source, key, command } of commands) {
      const host = hostOf(command);
      expect(host, `${source}: "${command}" does not pin a host`).toBeDefined();

      // 🚫 The assertion is delegated, not restated. If the policy changes,
      // this guard changes with it. ⚠️ ADR-0076 D2: the boundary comes from
      // WHICH COMMAND this is — the compose guard below is what makes the
      // container boundary true.
      expect(assertConsoleBindHost(host as string, boundaryOf(key))).toBe(host);
      checked += 1;
    }
    expect(checked).toBe(commands.length);
  });

  it('pins every host-boundary command explicitly rather than relying on a framework default', () => {
    const commands = startCommands();
    let checked = 0;
    let containerCommands = 0;
    for (const { key, command } of commands) {
      if (boundaryOf(key) === 'loopback-published-container') {
        // ⚠️ The container command is not EXEMPT — it is held to a different,
        // stricter proof: this host plus the no-published-port guard below.
        expect(hostOf(command)).toBe('0.0.0.0');
        containerCommands += 1;
      } else {
        expect(hostOf(command)).toBe(DEFAULT_STUDIO_BIND_HOST);
      }
      checked += 1;
    }
    expect(checked).toBe(commands.length);
    // ⚠️ Exactly ONE command may carry the container boundary. A second one is
    // how the exception quietly becomes the rule.
    expect(containerCommands).toBe(1);
  });

  /**
   * 🛑 **THE LINE THAT DECIDES WHO CAN REACH THE CONSOLE** — ADR-0076 D3 as
   * amended by that ADR's §0.4b.
   *
   * `start:container` binds `0.0.0.0`, and that is sound for exactly one
   * reason: the publication below confines it to host loopback. ⚠️ **The
   * dangerous edit is not adding a `ports:` key — it is dropping five
   * characters from the one that is there.** `'3100:3100'` publishes on every
   * interface, including the public one, and the console would be on the
   * internet with no TLS and no session boundary in front of it, while every
   * other guard in this file stayed green.
   *
   * ⚠️ **THIS ASSERTION USED TO BE `not.toMatch(/ports:/)`.** The console was to
   * publish nothing and sit behind an AGE-owned proxy on 80/443; 🚫 that proxy
   * could not exist, because the host's nginx already owns both ports for five
   * peer vhosts.
   */
  it('publishes the console on host loopback and nowhere else', () => {
    const compose = repoFile('deploy/vps/compose/docker-compose.studio.yml');
    const services = compose.split(/\n {2}(?=\w)/);
    const studio = services.find((block) => block.trimStart().startsWith('studio:'));

    // ⚠️ Assert the parse found the service FIRST — a renamed service would
    // otherwise make every assertion below vacuous.
    expect(studio, 'no studio service found in the compose file').toBeDefined();

    const uncommented = (text: string): string =>
      text
        .split('\n')
        .filter((line) => !/^\s*#/.test(line))
        .join('\n');

    const body = uncommented(studio as string);

    expect(body).toContain("- '127.0.0.1:3100:3100'");
    // 🛑 Nothing else is published — asserted as an exact list, because a SECOND
    // mapping is how a public one arrives beside the correct one.
    expect(body.match(/^\s*-\s*['"]?[\d.]+:\d+/gm)).toHaveLength(1);

    // 🛑 The console reaches AGE's own store, and the file names no other
    // network — the assertion that makes "console -> peer databases: denied" a
    // property of the deployment rather than a hope.
    expect(body).toMatch(/age-internal/);
  });

  /**
   * ⚠️ **THIS GUARD USED TO READ `ships no Dockerfile`, AND ADR-0076 D1/D2
   * REPLACED IT — 🚫 it was not deleted.** The old refusal named the real
   * danger ("a published container port in front of a loopback listener is
   * exactly the case OX-INV-1 cannot see"). The container the owner asked for
   * is sound precisely because that port never exists, so the guard now asserts
   * the thing the old one was protecting against, rather than the absence of
   * the file.
   *
   * 🛑 The Dockerfile must still carry NO SECRET (D6). An `ARG`/`ENV` credential
   * is readable in the image layer by anyone who can pull it.
   */
  it('builds an image that carries no credential in a layer', () => {
    const dockerfile = repoFile('apps/studio/Dockerfile');
    const instructions = dockerfile
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

    let checked = 0;
    for (const banned of [
      /\bARG\s+\w*(SECRET|TOKEN|PASSWORD|DATABASE_URL)/i,
      /\bENV\s+\w*(SECRET|TOKEN|PASSWORD|DATABASE_URL)/i,
      /postgres(ql)?:\/\//i,
    ]) {
      expect(instructions, `the Dockerfile must not carry ${String(banned)}`).not.toMatch(banned);
      checked += 1;
    }
    expect(checked).toBe(3);

    // ⚠️ THE POSITIVE HALF: an empty file would pass the scan above. The image
    // must actually run the container-boundary command (D2), 🚫 not `start`.
    expect(instructions).toMatch(/start:container/);
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

      // ⚠️ `0.0.0.0` IS NO LONGER BANNED OUTRIGHT — ADR-0076 D2 gives it one
      // legitimate home. What must stay impossible is a SECOND one, so the
      // scan pins the exact number of occurrences instead of forbidding the
      // token. A new `-H 0.0.0.0` anywhere fails this.
      const occurrences = text.match(/0\.0\.0\.0/g) ?? [];
      const permitted = source === 'apps/studio/package.json' ? 1 : 0;
      expect(occurrences.length, `${source} carries an unexpected 0.0.0.0`).toBe(permitted);
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

    // ⚠️ The module now names `0.0.0.0` once, for the container boundary. The
    // scan that matters is unchanged: NO ENVIRONMENT READ may reach the bind
    // host. The boundary is observed from the filesystem (`/.dockerenv`) and
    // passed to the policy as an ARGUMENT — 🚫 it is never configurable.
    expect((code.match(/0\.0\.0\.0/g) ?? []).length).toBe(1);
    expect(code).not.toMatch(/process\.env\.[A-Z_]*(HOST|BOUNDARY|CONTAINER)/);
  });

  /**
   * ⚠️ THE POSITIVE HALF: the negative scan above is satisfied by a file that
   * reports nothing at all. The console must still derive its reported host
   * from the ONE policy, so the value on screen is a value the policy accepted.
   */
  it('derives the reported bind host from the one policy', () => {
    const text = repoFile('apps/studio/src/server/operator-environment.ts');
    expect(text).toMatch(/assertConsoleBindHost/);
    expect(text).toMatch(/DEFAULT_STUDIO_BIND_HOST/);
  });

  /**
   * 🛑 THE THIRD PLACE THE INVARIANT CAN BE BROKEN, AND THE EASIEST ONE TO
   * BREAK BY ACCIDENT — the deploy script.
   *
   * ⚠️ **THIS GUARD USED TO BAN `nginx`, `certbot` AND `proxy_pass` OUTRIGHT.**
   * It was right at the time: `apps/studio` had no sign-in, so a proxy in front
   * of it published an UNAUTHENTICATED console. ADR-0074 slices 2/3 gave the
   * console a real verified-session boundary and ADR-0076 put it in a container,
   * so a proxy is now the SANCTIONED path and banning it would be a guard
   * defending a fact that stopped being true. 🚫 The bans were not deleted
   * silently; they were replaced by the crossings that still ARE crossings.
   */
  it('ships no deployment path that publishes the console or credentials', () => {
    // ⚠️ ADR-0077 D3 SPLIT THE DEPLOYMENT PATH IN TWO. `age-deploy` has no
    // `sudo docker`, so the compose and exec halves now live in root-owned
    // wrappers. 🛑 THE SCAN MUST FOLLOW THEM: scanning only the script would
    // declare the crossings absent from a file they had simply moved out of.
    const script = repoFile('scripts/deploy-studio.sh');
    const wrappers = [
      'deploy/vps/wrappers/age-deploy-compose-up',
      'deploy/vps/wrappers/age-deploy-docker-probe',
      'deploy/vps/wrappers/age-deploy-derive-env',
      'deploy/vps/wrappers/age-deploy-nginx-apply',
    ].map((path) => repoFile(path));

    // ⚠️ The script EXPLAINS which crossings it refuses, so comments are
    // stripped before the scan — the same rule as the source guard above.
    const commands = [script, ...wrappers]
      .join('\n')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

    let checked = 0;
    for (const banned of [
      // 🛑 D3: the ONE publication lives in the compose file, where a guard
      // asserts it is loopback-confined. 🚫 A second one added here — an
      // ad-hoc `docker run -p 3100:3100` to "check something quickly" — would
      // be public, and no guard reads a command that was never written down.
      /-p\s+\d*:?3100/,
      /ports:\s*\n\s*-\s*['"]?\d*:?3100/,
      // 🛑 D6: no credential through a command line, an argument or an image
      // layer. ⚠️ The env file is written on the host by the provisioning
      // script; this one only DERIVES the container's copy in place.
      /--build-arg/,
      /postgres(ql)?:\/\/[^\s'"]*:[^\s'"@]+@/i,
      // 🚫 A peer's network must never be attached to the console after the
      // fact — the one edit that would restore the violation D1 removed, and
      // the one the compose guard cannot see because it is not in that file.
      /network\s+connect\s+\S*(infra|rankops|drishti|scanner|dd-agency)\S*\s+age-studio/,
    ]) {
      expect(commands, `the deploy script must not carry ${String(banned)}`).not.toMatch(banned);
      checked += 1;
    }
    expect(checked).toBe(5);

    // ⚠️ THE POSITIVE HALF: a script that did nothing would also pass the scan
    // above. It must actually deploy THE CONTAINERISED console (ADR-0076 D1)
    // and prove the boundary FROM INSIDE the running container (D7).
    // ⚠️ Both ends, since D3 moved the operation: the script must still reach
    // the wrappers, and the wrappers must still do the thing.
    expect(script).toMatch(/age-deploy-compose-up/);
    expect(script).toMatch(/age-deploy-docker-probe/);
    const wrapperBodies = wrappers.join('\n');
    expect(wrapperBodies).toMatch(/docker-compose\.studio\.yml/);
    expect(wrapperBodies).toMatch(/docker (compose|exec)/);
  });
});
