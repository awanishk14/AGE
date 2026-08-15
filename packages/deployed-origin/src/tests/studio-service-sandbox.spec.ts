import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The sandbox on the unit `scripts/deploy-studio.sh` writes (ADR-0074 §7 slice 4).
 *
 * 🛑 **THE ACCOUNT THIS SERVICE RUNS AS HOLDS `NOPASSWD: ALL` ON A HOST IT
 * SHARES WITH FOUR OTHER PRODUCTS.** That was measured, not assumed. While the
 * console was reachable only through an SSH tunnel it was a theoretical
 * concern; the moment it answers the public internet, any code-execution defect
 * in it is root on that shared host — and the blast radius is every peer's
 * database. `NoNewPrivileges` is what makes `sudo` inside the service simply not
 * work, for the process and every child it will ever have.
 *
 * ⚠️ **AND `IPAddressDeny=any` IS HOW "AGE MUST NOT REACH A PEER'S DATABASE"
 * BECOMES A MECHANISM RATHER THAN A PROMISE.** The console makes no outbound
 * call at all: it is model-free, fetches no URL, and speaks to exactly one
 * database on loopback. Denying everything else removes the Docker bridge
 * subnets where the peer stores live from this process's reach entirely.
 *
 * 🚫 **IT DOES NOT CLOSE THE WHOLE QUESTION, AND THIS GUARD MUST NOT BE READ AS
 * SAYING IT DOES.** A peer instance is published on `127.0.0.1:5432`, and
 * loopback has to stay open for AGE's own store on `127.0.0.1:5442` — a
 * port-level rule is not expressible in a unit. That residue is what ADR-0076
 * is about.
 *
 * ⚠️ **WHY A GUARD AT ALL:** every line asserted here can be deleted without
 * breaking anything visible. The service starts, the console works, every test
 * stays green, and the only difference is the size of the hole under a defect
 * nobody has found yet.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const SCRIPT_PATH = join(REPO, 'scripts', 'deploy-studio.sh');

const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');

/**
 * ⚠️ Comments come off before every scan. The script EXPLAINS each directive in
 * prose that names it, so an unstripped scan would pass on the explanation of a
 * line that had been deleted.
 */
const SCRIPT_BODY = SCRIPT.split('\n')
  .map((line) => line.trimEnd())
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('there is a unit to examine', () => {
  it('found the deploy script, and it still writes a systemd unit', () => {
    expect(SCRIPT_BODY.length).toBeGreaterThan(1000);
    expect(SCRIPT_BODY).toContain('[Service]');
    expect(SCRIPT_BODY).toContain('WantedBy=multi-user.target');
  });
});

describe('the service cannot elevate', () => {
  it('sets NoNewPrivileges', () => {
    // 🛑 The single most important line in the unit. 🚫 Do not remove it to make
    // a deployment step convenient — deployment runs over ssh, not through the
    // service.
    expect(SCRIPT_BODY).toContain('NoNewPrivileges=yes');
  });

  const HARDENING: readonly string[] = [
    'PrivateTmp=yes',
    'PrivateDevices=yes',
    'ProtectSystem=strict',
    'ProtectHome=read-only',
    'ProtectKernelTunables=yes',
    'ProtectKernelModules=yes',
    'ProtectControlGroups=yes',
    'RestrictSUIDSGID=yes',
    'RestrictRealtime=yes',
    'LockPersonality=yes',
  ];

  it('keeps the filesystem and kernel surfaces closed', () => {
    let examined = 0;
    for (const directive of HARDENING) {
      examined += 1;
      expect(SCRIPT_BODY, `${directive} is missing from the unit`).toContain(directive);
    }
    expect(examined).toBe(HARDENING.length);
  });

  it('grants write access to the checkout and the operator workspace, and 🚫 nothing else', () => {
    // ⚠️ `ProtectSystem=strict` makes the whole filesystem read-only, so the two
    // paths the console legitimately writes have to be named. ⚠️ NAMED, not
    // widened: a `ReadWritePaths=/` would satisfy the directive and defeat it.
    const readWrite = SCRIPT_BODY.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('ReadWritePaths='));
    expect(readWrite).toEqual(['ReadWritePaths=${AGE_VPS_PATH} ${AGE_VPS_DISCOVERY_WORKSPACE}']);
  });
});

describe('the service cannot reach a peer product over the network', () => {
  it('denies every address and then re-allows loopback only', () => {
    const allowed = SCRIPT_BODY.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('IPAddressAllow='));

    expect(SCRIPT_BODY).toContain('IPAddressDeny=any');
    // 🛑 THE ALLOW LIST IS THE WHOLE GUARD. One `IPAddressAllow=172.16.0.0/12`
    // — the shape somebody reaches for when a container cannot be contacted —
    // puts every peer's database back inside this process's reach, and nothing
    // anywhere would report a change.
    expect(allowed).toEqual(['IPAddressAllow=127.0.0.1/32', 'IPAddressAllow=::1/128']);
  });

  it('speaks only the address families it actually uses', () => {
    expect(SCRIPT_BODY).toContain('RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX');
  });

  it('🚫 does not claim the peer store on loopback is closed too', () => {
    // ⚠️ ADR-0076's question. `IPAddressAllow=127.0.0.1/32` is REQUIRED for
    // AGE's own store on 127.0.0.1:5442, and it necessarily re-opens the peer
    // instance published on 127.0.0.1:5432. The unit says so in its own words,
    // and this assertion is here so a later edit cannot quietly delete the
    // caveat while keeping the directive.
    expect(SCRIPT).toContain('ADR-0076');
    expect(SCRIPT).toContain('127.0.0.1:5432');
  });
});
