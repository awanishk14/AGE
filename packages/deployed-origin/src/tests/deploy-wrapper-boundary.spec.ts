import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0077 D6 — the guards that are REPOSITORY facts.
 *
 * 🛑 GUARDS 1, 2 AND 5 ARE HOST FACTS AND ARE NOT HERE, ON PURPOSE. Whether
 * `age-deploy` is in the `docker` group, what `sudo -l` lists for it, and
 * whether `/usr/local/sbin` is root-owned are properties of a running box. A
 * repository test cannot assert them and 🚫 must not pretend to — they are
 * measured against the real VPS in the migration slice and their output is
 * recorded in `docs/reviews/ADR0077_DEPLOY_IDENTITY_CHECKPOINT.md`.
 *
 * What IS a repository fact is the SHAPE of the wrappers: that no path is
 * caller-controlled, and that no caller argument reaches `docker`, `nginx`,
 * `certbot` or `systemctl`. That is guard 3 and guard 4, and it is the
 * realistic failure mode — a wrapper drifting toward convenience.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const WRAPPER_DIR = join(REPO, 'deploy', 'vps', 'wrappers');

const EXPECTED_WRAPPERS = [
  'age-deploy-compose-up',
  'age-deploy-derive-env',
  'age-deploy-docker-probe',
  'age-deploy-nginx-apply',
] as const;

/** The three that take no arguments at all. */
const NO_ARGUMENT_WRAPPERS = [
  'age-deploy-compose-up',
  'age-deploy-derive-env',
  'age-deploy-nginx-apply',
] as const;

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE ANY SCAN. A wrapper's own explanation of the
 * rule it obeys contains the banned tokens — that is the `vitest-worker-cap`
 * lesson, and without this every guard below would pass for the wrong reason.
 *
 * 🚫 It is not a shell parser. It removes whole-line comments and trailing
 * comments that begin at an unquoted `#`.
 */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      if (line.trimStart().startsWith('#')) return '';
      let inSingle = false;
      let inDouble = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === "'" && !inDouble) inSingle = !inSingle;
        else if (character === '"' && !inSingle) inDouble = !inDouble;
        else if (
          character === '#' &&
          !inSingle &&
          !inDouble &&
          index > 0 &&
          line[index - 1] === ' '
        ) {
          return line.slice(0, index);
        }
      }
      return line;
    })
    .join('\n');
}

const wrapperFiles = readdirSync(WRAPPER_DIR).filter((name) => name.startsWith('age-deploy-'));

const SOURCES = new Map<string, string>(
  wrapperFiles.map((name) => [name, readFileSync(join(WRAPPER_DIR, name), 'utf8')]),
);

const BODIES = new Map<string, string>(
  [...SOURCES].map(([name, source]) => [name, stripComments(source)]),
);

describe('ADR-0077 D6 guard 6 — the walk found something', () => {
  it('located exactly the four wrappers the ADR names', () => {
    // 🛑 AN EMPTY SCAN MUST NEVER BE ABLE TO REPORT COMPLIANCE. Every guard
    // below iterates this list; if it were empty they would all pass silently.
    expect(wrapperFiles.length).toBeGreaterThan(0);
    expect([...wrapperFiles].sort()).toEqual([...EXPECTED_WRAPPERS]);
  });

  it('read a non-empty body for each, after comments were stripped', () => {
    let examined = 0;
    for (const name of EXPECTED_WRAPPERS) {
      const body = BODIES.get(name);
      expect(body, name).toBeDefined();
      expect(body!.trim().length, name).toBeGreaterThan(0);
      examined += 1;
    }
    expect(examined).toBe(EXPECTED_WRAPPERS.length);
  });

  it('stripped comments rather than deleting the file', () => {
    // ⚠️ The stripper itself is made to matter here: the raw source of every
    // wrapper mentions `docker`, and a stripper that returned '' would make
    // every scan below vacuous.
    for (const name of EXPECTED_WRAPPERS) {
      expect(SOURCES.get(name)!.length, name).toBeGreaterThan(BODIES.get(name)!.trim().length);
      expect(BODIES.get(name)!, name).toContain('set -euo pipefail');
    }
  });
});

describe('ADR-0077 D6 guard 3 — no wrapper takes a caller-controlled path', () => {
  /** Positional and wildcard expansions, in any form. */
  const CALLER_EXPANSIONS = [/\$1\b/, /\$2\b/, /\$3\b/, /\$@/, /\$\*/, /\$\{1\b/, /\$\{@/];

  it('never lets a positional argument reach a path position', () => {
    let examined = 0;
    for (const name of EXPECTED_WRAPPERS) {
      const body = BODIES.get(name)!;
      for (const line of body.split('\n')) {
        const isPathPosition =
          /(^|\s)(cd|cp|rm|ln|chmod|chown|chgrp|stat|cat|sed|grep|install|tee|mkdir)\s/.test(
            line,
          ) ||
          // ⚠️ A file redirect, 🚫 not `>&2` — a file descriptor is not a path.
          />\s*[^&\s]/.test(line) ||
          /\s-f\s/.test(line);
        if (!isPathPosition) continue;
        for (const expansion of CALLER_EXPANSIONS) {
          expect(expansion.test(line), `${name}: ${line.trim()}`).toBe(false);
        }
        examined += 1;
      }
    }
    // ⚠️ Assert the scan actually looked at path-position lines — a regex that
    // matched nothing would report a boundary that was never checked.
    expect(examined).toBeGreaterThan(10);
  });

  it('declares every filesystem path it touches as a single-quoted literal', () => {
    let examined = 0;
    for (const name of EXPECTED_WRAPPERS) {
      const body = BODIES.get(name)!;
      const paths = body.match(/(^|[\s'"=])(\/(etc|var|home|usr|opt)\/[^\s'"$]*)/g) ?? [];
      for (const raw of paths) {
        const path = raw.trim().replace(/^["'=]/, '');
        // Every such path must appear inside a single-quoted assignment, or as
        // part of a literal in the fixed probe text — never built from input.
        expect(body, `${name}: ${path}`).toMatch(
          new RegExp(`'[^'\\n]*${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        );
        examined += 1;
      }
    }
    expect(examined).toBeGreaterThan(5);
  });

  it('never uses eval, a caller-supplied sed expression, or a root shell', () => {
    let examined = 0;
    for (const name of EXPECTED_WRAPPERS) {
      const body = BODIES.get(name)!;
      expect(body, name).not.toMatch(/\beval\b/);
      // 🛑 `sh -c "$…"` is the shape ADR-0077 D3 wrapper 2 exists to remove.
      expect(body, name).not.toMatch(/\b(sh|bash)\s+-c\s+["']?\$/);
      expect(body, name).not.toMatch(/sed[^\n]*\$[1-9@*]/);
      examined += 1;
    }
    expect(examined).toBe(EXPECTED_WRAPPERS.length);
  });
});

describe('ADR-0077 D6 guard 4 — no caller argument reaches docker, nginx, certbot or systemctl', () => {
  it('refuses any argv at all in the three no-argument wrappers', () => {
    let examined = 0;
    for (const name of NO_ARGUMENT_WRAPPERS) {
      const body = BODIES.get(name)!;
      expect(body, name).toMatch(/if \[ "\$#" -ne 0 \]; then/);
      expect(body, name).toMatch(/REFUSED/);
      // 🚫 And they must not read a positional argument anywhere.
      expect(body, name).not.toMatch(/\$\{?[1-9]\b/);
      examined += 1;
    }
    expect(examined).toBe(NO_ARGUMENT_WRAPPERS.length);
  });

  it('validates the probe wrapper argv against enumerated allowlists before docker', () => {
    const body = BODIES.get('age-deploy-docker-probe')!;

    // 🛑 THE ORDER IS THE PROOF. The verb allowlist is checked before ANY
    // `docker` in the file.
    const firstDocker = body.indexOf('docker ');
    expect(firstDocker).toBeGreaterThan(0);
    expect(body.slice(0, firstDocker)).toContain('inspect | logs | exec-probe | ps');

    // ⚠️ The container allowlist cannot precede the first `docker`, because the
    // `ps` verb takes no container and is served before one is read. So the
    // assertion is the one that actually matters: it precedes every `docker`
    // line that USES a container name.
    const containerAllowlist = body.indexOf('age-studio | age-postgres');
    expect(containerAllowlist).toBeGreaterThan(0);
    for (const [index, line] of body.split('\n').entries()) {
      if (!/\bdocker\b/.test(line) || !line.includes('$container')) continue;
      const offset = body.split('\n').slice(0, index).join('\n').length;
      expect(offset, line.trim()).toBeGreaterThan(containerAllowlist);
    }

    // 🚫 And every `case` over caller input has a default-refuse branch.
    const caseBlocks = body.match(/case "\$\w+" in[\s\S]*?esac/g) ?? [];
    expect(caseBlocks.length).toBeGreaterThan(2);
    const overCallerInput = caseBlocks.filter((block) =>
      /case "\$(verb|container|probe)"/.test(block),
    );
    expect(overCallerInput.length).toBe(3);
    for (const block of overCallerInput) {
      expect(block).toMatch(/\*\)/);
      expect(block).toContain('refuse');
    }
  });

  it('passes only the validated container name to docker, never raw argv', () => {
    const body = BODIES.get('age-deploy-docker-probe')!;
    const dockerLines = body.split('\n').filter((line) => /\bdocker\b/.test(line));
    expect(dockerLines.length).toBeGreaterThan(2);
    for (const line of dockerLines) {
      expect(line, line.trim()).not.toMatch(/\$[1-9@*]/);
      expect(line, line.trim()).not.toMatch(/\$\{[1-9@*]/);
      expect(line, line.trim()).not.toMatch(/\$(verb|probe)\b/);
    }
  });

  it('never names certbot at all', () => {
    // ADR-0077 D4 — certbot gets no wrapper and no sudoers entry, because
    // `--deploy-hook` runs arbitrary commands as root.
    let examined = 0;
    for (const name of EXPECTED_WRAPPERS) {
      expect(SOURCES.get(name)!.replace(/certbot\.timer/g, ''), name).not.toMatch(
        /^[^#\n]*\bcertbot\b/m,
      );
      examined += 1;
    }
    expect(examined).toBe(EXPECTED_WRAPPERS.length);
  });
});

describe('ADR-0077 D2 — the sudoers drop-in grants nothing but the four wrappers', () => {
  const SUDOERS = readFileSync(join(WRAPPER_DIR, 'sudoers.age-deploy'), 'utf8');
  const BODY = SUDOERS.split('\n').filter((line) => !line.trimStart().startsWith('#'));
  const RULES = BODY.filter((line) => line.trim().length > 0);

  it('has exactly one rule per wrapper and no more', () => {
    expect(RULES.length).toBe(4);
    for (const wrapper of EXPECTED_WRAPPERS) {
      expect(RULES.filter((rule) => rule.includes(`/usr/local/sbin/${wrapper}`)).length).toBe(1);
    }
  });

  it('grants no ALL, no shell, and no command that takes free arguments', () => {
    const body = RULES.join('\n');
    expect(body).not.toMatch(/NOPASSWD:\s*ALL/);
    expect(body).not.toMatch(/\(ALL\s*:\s*ALL\)/);
    for (const forbidden of [
      '/usr/bin/docker',
      '/usr/sbin/nginx',
      '/usr/bin/certbot',
      '/usr/bin/systemctl',
      '/bin/sh',
      '/bin/bash',
      '/usr/bin/tee',
      '/usr/bin/install',
    ]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it('permits the three no-argument wrappers with no arguments at all', () => {
    for (const wrapper of NO_ARGUMENT_WRAPPERS) {
      const rule = RULES.find((line) => line.includes(wrapper))!;
      expect(rule, wrapper).toMatch(/""\s*$/);
    }
  });
});
