import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The isolation around the deployed console — ADR-0076 D1/D3/D4/D5/D6/D7.
 *
 * ⚠️ **THIS FILE USED TO GUARD A SYSTEMD UNIT, AND THE REASON IT NO LONGER DOES
 * IS THE POINT — 🚫 NOT AN OMISSION.** The unit's `NoNewPrivileges`,
 * `ProtectSystem=strict` and `IPAddressDeny=any` were the strongest isolation
 * available to a process running ON THE HOST, and they left one residue that
 * systemd cannot express: `IPAddressAllow=127.0.0.1/32` has to stay open for
 * AGE's own store on `127.0.0.1:5442`, and there is no port-level rule, so a
 * peer's PostgreSQL published on `127.0.0.1:5432` stayed reachable.
 * ⚠️ **THAT WAS MEASURED ON THE REAL VPS, NOT PREDICTED.**
 *
 * 🛑 **THE PRODUCT OWNER REFUSED TO ACCEPT THAT RESIDUE**, on the ground that
 * every other application on the host is containerised precisely so a
 * compromise of one cannot reach the others. ADR-0076 D1 therefore REMOVES the
 * reach instead of filtering it: the console runs in a namespace attached to
 * one network, which carries AGE's own store and no peer.
 *
 * ⚠️ **WHAT THIS FILE DOES NOT GUARD ANY MORE, AND WHY.** It asserted that the
 * console published NO port and that an AGE-owned nginx published 80/443. 🚫 The
 * second could never have run — the host's nginx already owns both for five peer
 * vhosts — and without it the first only moved the loopback hop rather than
 * removing it (ADR-0076 §0.4b). The assertions were replaced by the one that
 * actually decides reachability: the exact published mapping.
 *
 * ⚠️ **WHY A GUARD AT ALL:** every line asserted here can be deleted without
 * breaking anything visible. The container starts, the console works, every test
 * stays green, and the only difference is the size of the hole under a defect
 * nobody has found yet.
 *
 * 🚫 **AND WHAT THIS FILE STILL DOES NOT PROVE.** Reading a compose file is not
 * reaching a socket. The boundary is proven by D7 — a raw TCP connect from
 * INSIDE the running container, on the real VPS — and this guard only asserts
 * that the deployment still performs that proof.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const COMPOSE_PATH = join(REPO, 'deploy', 'vps', 'compose', 'docker-compose.studio.yml');
const DOCKERFILE_PATH = join(REPO, 'apps', 'studio', 'Dockerfile');
const SCRIPT_PATH = join(REPO, 'scripts', 'deploy-studio.sh');

const COMPOSE = readFileSync(COMPOSE_PATH, 'utf8');
const DOCKERFILE = readFileSync(DOCKERFILE_PATH, 'utf8');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');

/**
 * ⚠️ Comments come off before every scan. Each file EXPLAINS the rule it obeys
 * in prose that names it, so an unstripped scan would pass on the explanation of
 * a line that had been deleted.
 */
const stripped = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

const COMPOSE_BODY = stripped(COMPOSE);

/** The block of the compose file belonging to one service. */
const serviceBlock = (name: string): string => {
  const blocks = COMPOSE_BODY.split(/\n {2}(?=\w)/);
  const found = blocks.find((block) => block.trimStart().startsWith(`${name}:`));
  // ⚠️ Asserted here so a renamed service can never make a later scan vacuous.
  expect(found, `no ${name} service found in the compose file`).toBeDefined();
  return found as string;
};

describe('there is a deployment to examine', () => {
  it('found the compose file, the image and the deploy script', () => {
    expect(COMPOSE_BODY.length).toBeGreaterThan(400);
    expect(stripped(DOCKERFILE).length).toBeGreaterThan(400);
    expect(stripped(SCRIPT).length).toBeGreaterThan(1000);
    expect(COMPOSE_BODY).toContain('studio:');
  });
});

describe('the console cannot reach a peer product over the network', () => {
  it('🛑 attaches the console to AGE’s own network and 🚫 nothing else', () => {
    // 🛑 THE NETWORK LIST IS THE WHOLE GUARD, and it is the container-era
    // successor of the unit's `IPAddressAllow` list. One extra entry —
    // `infra_default`, `rankops-internal`, the shape somebody reaches for when a
    // peer "cannot be contacted" — puts that peer's database back inside the
    // console's reach, and nothing anywhere would report a change.
    const networks = serviceBlock('studio')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^- age[\w-]*$/.test(line));

    expect(networks).toEqual(['- age-internal']);
  });

  it('declares no peer network anywhere in the file', () => {
    let examined = 0;
    for (const peer of [
      'infra_default',
      'rankops-internal',
      'drishti_internal',
      'scanner-infra',
      'dd-agency',
      'network_mode',
      'host.docker.internal',
    ]) {
      examined += 1;
      expect(COMPOSE_BODY, `${peer} must not appear in the console's deployment`).not.toContain(
        peer,
      );
    }
    expect(examined).toBe(7);
  });

  it('🚫 builds no AGE-owned public proxy, because it could not exist', () => {
    // ⚠️ D4 AS AMENDED BY §0.4b. The public terminator is the HOST's nginx,
    // which already owns 80/443 for five peer vhosts and has no Docker network
    // membership at all — so it still has no route to any database. A `proxy`
    // service here would fail to bind and take those five sites down with it.
    expect(COMPOSE_BODY).not.toContain('nginx');
    expect(COMPOSE_BODY).not.toContain('age-edge');
  });
});

describe('the console is published on host loopback, and 🚫 nowhere else', () => {
  it('🛑 declares exactly one published port, bound to 127.0.0.1', () => {
    // 🛑 THE ONE LINE THAT DECIDES WHO CAN REACH THE CONSOLE (D3 as amended).
    // `start:container` binds `0.0.0.0` inside the namespace, which is sound for
    // exactly one reason: this mapping confines it to host loopback.
    // ⚠️ `'3100:3100'` — five characters shorter, visually near-identical —
    // publishes on EVERY interface, putting the console on the public internet
    // without TLS and without the session boundary in front of it.
    const published = serviceBlock('studio')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^- ['"]?[\d.]+:\d+/.test(line));

    expect(published).toEqual(["- '127.0.0.1:3100:3100'"]);
  });

  it('🚫 publishes the database from this file, ever', () => {
    // ⚠️ `age-postgres` is published on `127.0.0.1:5442` by ADR-0075's own
    // stack, for the host-side capture CLI. 🚫 This file must not add a second
    // publication of it, on any interface.
    expect(COMPOSE_BODY).not.toContain('5442');
    expect(COMPOSE_BODY).not.toContain('5432:');
  });
});

describe('the container cannot elevate, and sees almost nothing of the host', () => {
  it('sets no-new-privileges on the console', () => {
    // 🛑 The container-era successor of the unit's most important line. The
    // account this deployment runs under holds `NOPASSWD: ALL` on a host it
    // shares with four other products; `sudo` inside the container must simply
    // not work, for the process and every child it will ever have.
    expect(serviceBlock('studio'), 'the console may not gain privileges').toContain(
      'no-new-privileges:true',
    );
  });

  it('🛑 mounts the operator’s two paths READ-ONLY, and 🚫 nothing else', () => {
    // ⚠️ The successor of `ProtectSystem=strict` + `ReadWritePaths`. NAMED, not
    // widened: a `- /:/host` would satisfy "there are mounts" and defeat it.
    // 🚫 Every mount here ends `:ro` — the console writes nothing on the host.
    const block = serviceBlock('studio');
    // ⚠️ Bounded at BOTH ends. An unbounded slice runs on into `security_opt`
    // and `healthcheck`, and the list stops meaning "the mounts".
    const after = block.slice(block.indexOf('\n    volumes:') + 1);
    const nextKey = after.slice(1).search(/\n {4}\w/);
    const volumesSection = nextKey === -1 ? after : after.slice(0, nextKey + 1);
    const mounts = volumesSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '));

    expect(mounts).toEqual([
      '- ${AGE_VPS_DISCOVERY_WORKSPACE}:${AGE_VPS_DISCOVERY_WORKSPACE}:ro',
      '- ${AGE_VPS_CLIENT_RECORD_FILE}:${AGE_VPS_CLIENT_RECORD_FILE}:ro',
    ]);

    // ⚠️ Asserted separately so a mount added WITHOUT `:ro` fails on the reason
    // it is wrong, not merely on list equality.
    for (const mount of mounts) {
      expect(mount.endsWith(':ro'), `${mount} is not read-only`).toBe(true);
    }
  });

  it('🛑 NAMES the two paths it mounts, or the console cannot see them', () => {
    // ⚠️ MEASURED ON THE REAL DEPLOYMENT, AFTER THE MOUNTS WERE ALREADY RIGHT:
    // the console reported *"No client record file is configured, so the console
    // has not looked for one"* — the HONEST answer, because ADR-0054 D2/D3 refuse
    // a defaulted path and nothing had told the container where to look.
    // 🛑 A mount without the variable is a deployment that is silently empty of
    // every business, and 🚫 that reads exactly like a business having no data.
    // ⚠️ The values must be the SAME expressions as the mounts, so the path the
    // console names is the path it can actually open.
    const block = serviceBlock('studio');
    expect(block).toContain('AGE_CLIENT_RECORD_FILE: ${AGE_VPS_CLIENT_RECORD_FILE}');
    expect(block).toContain('AGE_DISCOVERY_WORKSPACE: ${AGE_VPS_DISCOVERY_WORKSPACE}');
  });

  it('does not run the console as root', () => {
    expect(stripped(DOCKERFILE)).toContain('USER node');
  });

  it('🛑 runs as the DERIVED owner of the record file, 🚫 never a literal uid', () => {
    // ⚠️ The compose `user:` OVERRIDES the image's `USER node`, so it is the line
    // that actually decides. 🛑 It must be a substitution: a literal here is a
    // host fact written into the repository, and the day the account changes the
    // console reads nothing and reports — honestly — that it found no
    // businesses. 🚫 And it must never be `0`; the deploy script refuses that
    // too, from the other side.
    expect(serviceBlock('studio')).toContain("user: '${AGE_STUDIO_UID}:${AGE_STUDIO_GID}'");
    expect(COMPOSE_BODY).not.toMatch(/user:\s*['"]?0[:'"]/);

    const script = stripped(SCRIPT);
    expect(script).toContain("stat -c %u '${AGE_VPS_CLIENT_RECORD_FILE}'");
    expect(script, 'the deploy must refuse a root-owned record rather than run as root').toMatch(
      /uid\\?" = '0'/,
    );
  });
});

describe('no credential reaches an image layer or a command line', () => {
  it('carries no secret in the image (D6)', () => {
    // ⚠️ A `--build-arg` is visible in `docker history`, which is the image's
    // equivalent of a command line being public on a shared host (#350).
    const body = stripped(DOCKERFILE);
    let examined = 0;
    for (const banned of [
      /\bARG\s+\w*(SECRET|TOKEN|PASSWORD|DATABASE_URL)/i,
      /\bENV\s+\w*(SECRET|TOKEN|PASSWORD|DATABASE_URL)/i,
      /postgres(ql)?:\/\//i,
      /COPY[^\n]*\.env/i,
    ]) {
      examined += 1;
      expect(body, `the image must not carry ${String(banned)}`).not.toMatch(banned);
    }
    expect(examined).toBe(4);
  });

  it('takes the credential from a host-side env file outside the checkout', () => {
    expect(COMPOSE_BODY).toContain('/etc/age-studio/age-studio.container.env');
    // 🚫 No literal environment value for the database in the compose file.
    expect(COMPOSE_BODY).not.toMatch(/DATABASE_URL\s*[:=]/);
  });
});

describe('the boundary is proven, not asserted', () => {
  it('🛑 probes reachability FROM INSIDE the running container (D7)', () => {
    // 🛑 THE OWNER ASKED FOR NETWORK REACHABILITY, 🚫 NOT FOR AN APPLICATION
    // QUERY THAT RETURNS NOTHING. A query can fail for a dozen reasons that have
    // nothing to do with the network.
    const body = stripped(SCRIPT);
    expect(body).toContain('docker exec age-studio');
    expect(body).toContain("require('node:net')");
  });

  it('expects AGE’s own store to be REACHABLE, not merely everything denied', () => {
    // ⚠️ A deployment that denied every address would pass a naive "nothing is
    // reachable" check and be entirely broken. The probe must assert BOTH
    // directions, or it proves nothing about the console working at all.
    const body = stripped(SCRIPT);
    expect(body).toContain("'ALLOWED'");
    expect(body).toContain("'DENIED'");
    expect(body).toContain('age-postgres');
  });

  it('🚫 does not claim the symmetric question is closed', () => {
    // ⚠️ ADR-0076 D8. AGE's own store is still PUBLISHED on `127.0.0.1:5442`
    // for the host-side capture CLI, so a compromised PEER can still reach AGE's
    // database. That is the mirror image of the problem this ADR solved, it is
    // deliberately still open, and this assertion is here so a later edit cannot
    // quietly delete the caveat while keeping the mechanism.
    expect(SCRIPT).toContain('ADR-0076');
  });
});
