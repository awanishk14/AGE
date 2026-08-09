import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO = join(__dirname, '..', '..', '..', '..');
const DEPLOY = join(REPO, 'deploy', 'vps');
const COMPOSE_PATH = join(DEPLOY, 'docker-compose.deployed.yml');
const CADDY_PATH = join(DEPLOY, 'Caddyfile');

const COMPOSE = readFileSync(COMPOSE_PATH, 'utf8');
const CADDY = readFileSync(CADDY_PATH, 'utf8');
const ROOT_COMPOSE = readFileSync(join(REPO, 'docker-compose.yml'), 'utf8');

function bodyLines(source: string): string[] {
  return source.split('\n').filter((line) => !line.trimStart().startsWith('#'));
}

/** Every published port, as written. */
function publishedPorts(source: string): string[] {
  const lines = bodyLines(source);
  const found: string[] = [];
  let inPorts = false;
  let indent = 0;

  for (const line of lines) {
    if (line.trim() === 'ports:') {
      inPorts = true;
      indent = line.length - line.trimStart().length;
      continue;
    }
    if (!inPorts) continue;
    const entry = line.trim();
    if (entry.startsWith('- ')) {
      found.push(entry.slice(2).replace(/['"]/g, ''));
      continue;
    }
    if (entry !== '' && line.length - line.trimStart().length <= indent) inPorts = false;
  }

  return found;
}

const BODY = bodyLines(COMPOSE).join('\n');

describe('this is a separate named composition, not a mode of the root one', () => {
  it('exists where its name says it does', () => {
    expect(existsSync(COMPOSE_PATH)).toBe(true);
    expect(existsSync(CADDY_PATH)).toBe(true);
  });

  it('is not selectable from the root composition', () => {
    // 🛑 ADR-0061 A5 — not a flag, not an `allowRemote`, not a quietly-permitting
    // second function. Running it is a deliberate act with a name.
    expect(ROOT_COMPOSE).not.toContain('deployed');
    expect(ROOT_COMPOSE).not.toContain('deploy/vps');
  });

  it('leaves the local rule its teeth', () => {
    // ⚠️ `assertLocalDatabaseTarget` is not this code path and is not relaxed.
    // ⚠️ The file's OWN explanation of the rule contains the word, so the
    // comments come off before the scan.
    expect(BODY.toLowerCase()).not.toContain('allowremote');
  });
});

describe('nothing behind the terminator is publicly reachable', () => {
  it('found ports to examine', () => {
    expect(publishedPorts(COMPOSE).length).toBeGreaterThanOrEqual(3);
  });

  it('publishes to the world only 80 and 443', () => {
    for (const port of publishedPorts(COMPOSE)) {
      const worldFacing = port === '80:80' || port === '443:443';
      const loopbackBound = port.startsWith('127.0.0.1:') || port.startsWith('[::1]:');

      expect(worldFacing || loopbackBound, port).toBe(true);
    }
  });

  it('never publishes the database on every interface', () => {
    // 🚫 '5432:5432' binds every interface on the machine.
    expect(publishedPorts(COMPOSE)).toContain('127.0.0.1:5432:5432');
    expect(publishedPorts(COMPOSE)).not.toContain('5432:5432');
    for (const port of publishedPorts(COMPOSE)) {
      expect(port.startsWith('0.0.0.0:'), port).toBe(false);
    }
  });
});

describe('an absent secret is a refusal to start', () => {
  it('found variables to examine', () => {
    expect(COMPOSE.match(/\$\{[A-Z_]+/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('defaults nothing', () => {
    // 🚫 `:-` is a default. A default password is a published one.
    for (const line of bodyLines(COMPOSE)) {
      expect(line, line).not.toContain(':-');
    }
  });

  it('requires every secret explicitly', () => {
    for (const variable of ['AGE_PUBLIC_HOST', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
      expect(COMPOSE).toContain(`\${${variable}:?`);
    }
  });

  it('commits no secret file', () => {
    expect(existsSync(join(DEPLOY, '.env'))).toBe(false);
  });
});

describe('no application is deployed here yet, and that is deliberate', () => {
  it('names no application service and builds no image', () => {
    // 🛑 `apps/studio` may not have a Dockerfile (ADR-0057, OX-INV-1), and
    // ADR-0061 §5's question — which product is hosted — is the owner's, still
    // open. A service here would answer it silently.
    expect(BODY).not.toContain('apps/studio');
    expect(bodyLines(COMPOSE).some((line) => line.trim().startsWith('build:'))).toBe(false);
    expect(existsSync(join(REPO, 'apps', 'studio', 'Dockerfile'))).toBe(false);
  });

  it('refuses to start rather than serving half a deployment', () => {
    expect(COMPOSE).toContain('${AGE_APP_UPSTREAM:?');
    expect(CADDY).toContain('reverse_proxy {$AGE_APP_UPSTREAM}');
  });
});

describe('TLS is terminated in front, and the header is set there', () => {
  it('overwrites the forwarded protocol rather than passing it through', () => {
    // ⚠️ A client-supplied value is a claim, not evidence.
    expect(CADDY).toContain('header_up X-Forwarded-Proto https');
  });

  it('serves no plaintext beyond a redirect', () => {
    expect(CADDY).toContain('redir https://{host}{uri} permanent');
    expect(CADDY).toContain('Strict-Transport-Security');
  });
});
