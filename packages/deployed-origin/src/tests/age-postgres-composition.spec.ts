import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * AGE's own store, and the boundary a peer may never cross — ADR-0075 D1–D6.
 *
 * 🛑 **WHY THIS GUARD EXISTS AT ALL.** The script it scans once wrote
 * `127.0.0.1:5432` into AGE's connection string and ran `sudo -u postgres psql`
 * on a host that has neither. On the real VPS, 5432 is ANOTHER PRODUCT'S
 * published port — so the merged code would have pointed AGE at a peer's
 * database, quietly, with every test in the repository green. ⚠️ That is the
 * exact failure mode a unit test cannot see: both halves were syntactically
 * fine and semantically catastrophic.
 *
 * ⚠️ **SO THE SCAN IS OF THE DEPLOYMENT ARTIFACTS THEMSELVES**, not of a model
 * of them. What is asserted here is what the operator will actually run.
 *
 * 🚫 **AND IT IS NOT A PROOF OF ISOLATION.** A compose file that says
 * `age-postgres` is a compose file that INTENDS a separate store; the running
 * container is checked on the box, by the script, before the migration. Neither
 * an empty result set nor RLS proves isolation either (ADR-0046 D5).
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const COMPOSE_PATH = join(REPO, 'deploy', 'vps', 'docker-compose.age-postgres.yml');
const SCRIPT_PATH = join(REPO, 'scripts', 'provision-studio-database.sh');

const COMPOSE = readFileSync(COMPOSE_PATH, 'utf8');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');
// ⚠️ ADR-0078 C1 — the migration now runs here, so the guard reads here too.
// ⚠️ C2 moved it into its OWN file: compose validates every service in a file,
// and the capture service's operator mounts have no place in a migration run.
const MIGRATE_COMPOSE = readFileSync(
  join(REPO, 'deploy', 'vps', 'compose', 'docker-compose.age-migrate.yml'),
  'utf8',
);

/**
 * ⚠️ Comments come off before every scan. Both files EXPLAIN the rules they
 * obey, in prose that contains the very tokens being searched for — a file's
 * own account of why it does not do X must not read as X.
 */
function bodyLines(source: string): string[] {
  return source.split('\n').filter((line) => !line.trimStart().startsWith('#'));
}

const COMPOSE_BODY = bodyLines(COMPOSE).join('\n');
const SCRIPT_BODY = bodyLines(SCRIPT).join('\n');
// ⚠️ Stripped for the same reason: this file's own comment forbids `migrate dev`.
const MIGRATE_COMPOSE_BODY = bodyLines(MIGRATE_COMPOSE).join('\n');

/** Every published port, as written. */
function publishedPorts(source: string): string[] {
  const found: string[] = [];
  let inPorts = false;
  let indent = 0;

  for (const line of bodyLines(source)) {
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

describe('the artifacts exist and there is something to examine', () => {
  it('found both files', () => {
    // ⚠️ An unreadable file would make every scan below vacuously pass.
    expect(existsSync(COMPOSE_PATH)).toBe(true);
    expect(existsSync(SCRIPT_PATH)).toBe(true);
    expect(COMPOSE_BODY.length).toBeGreaterThan(200);
    expect(SCRIPT_BODY.length).toBeGreaterThan(1000);
  });

  it('found ports to examine', () => {
    expect(publishedPorts(COMPOSE).length).toBe(1);
  });
});

describe("AGE's store is AGE's own — D1", () => {
  it('is its own container, on its own named volume, on its own network', () => {
    expect(COMPOSE_BODY).toContain('container_name: age-postgres');
    expect(COMPOSE_BODY).toContain('age_postgres_data:/var/lib/postgresql/data');
    expect(COMPOSE_BODY).toContain('age-internal');
  });

  it('🚫 reuses no peer container, volume or network — D3/D6', () => {
    // 🛑 AGE MUST NEVER SHARE A DATABASE WITH A PEER PRODUCT. Not RankOps today,
    // not SNARA tomorrow, not Humantik later. Named individually so a failure
    // says WHICH neighbour leaked in.
    for (const peer of ['rankops', 'snara', 'drishti', 'humantik']) {
      expect(COMPOSE_BODY.toLowerCase(), peer).not.toContain(peer);
    }
  });

  it('declares the network and volume itself rather than borrowing them', () => {
    // 🚫 `external: true` would attach AGE to something another deployment owns
    // — which is D4's dependency by another name.
    expect(COMPOSE_BODY).not.toContain('external: true');
  });
});

describe('the store is not public, and not on 5432', () => {
  it('publishes on loopback, written out', () => {
    const ports = publishedPorts(COMPOSE);
    expect(ports.length).toBe(1);
    expect(ports[0]?.startsWith('127.0.0.1:')).toBe(true);
  });

  it('🚫 publishes on no other interface', () => {
    for (const port of publishedPorts(COMPOSE)) {
      expect(port.startsWith('0.0.0.0:'), port).toBe(false);
      expect(port.startsWith('::'), port).toBe(false);
      // 🚫 A bare `5432:5432` binds every interface AND punches the host firewall.
      expect(/^\d+:\d+$/.test(port), port).toBe(false);
    }
  });

  it('🛑 defaults the host port to nothing', () => {
    // ⚠️ THE DEFAULT IS THE BUG. A defaulted port is how AGE would have dialled
    // another product's database while every test still passed.
    expect(COMPOSE_BODY).toContain('${AGE_DB_HOST_PORT:?');
    expect(COMPOSE_BODY).not.toContain('127.0.0.1:5432:');
  });
});

describe('an absent secret is a refusal to start', () => {
  it('requires every one of them explicitly', () => {
    for (const variable of [
      'AGE_DB_SUPERUSER',
      'AGE_DB_SUPERUSER_PASSWORD',
      'AGE_DB_NAME',
      'AGE_DB_HOST_PORT',
    ]) {
      expect(COMPOSE, variable).toContain(`\${${variable}:?`);
    }
  });

  it('🚫 defaults nothing', () => {
    // 🚫 `:-` is a default. A default password is a published one.
    for (const line of bodyLines(COMPOSE)) {
      expect(line, line).not.toContain(':-');
    }
  });

  it('commits no secret file', () => {
    expect(existsSync(join(REPO, 'deploy', 'vps', '.env'))).toBe(false);
  });
});

describe('the provisioning script targets AGE, and can no longer target a neighbour', () => {
  it('🛑 no longer assumes a host postgres user', () => {
    // 🚫 There is no `postgres` user on that VPS and there never was. `psql`
    // runs inside AGE's OWN container, addressed by name.
    expect(SCRIPT_BODY).not.toContain('sudo -u postgres');
    expect(SCRIPT_BODY).toContain('docker exec');
    expect(SCRIPT_BODY).toContain('age-postgres');
  });

  it('🛑 hardcodes no port into the connection string', () => {
    // ⚠️ THE ORIGINAL BUG, ASSERTED AGAINST BY SHAPE. The port is interpolated
    // from the required variable; the literal cannot come back.
    expect(SCRIPT_BODY).toContain('@127.0.0.1:%s/%s?schema=public');
    expect(SCRIPT_BODY).toContain('require AGE_DB_HOST_PORT');

    // 🛑 **THE LITERAL IS NO LONGER ABSENT, AND THE NARROWING IS THE POINT.**
    // ADR-0078 C1 moved migrations into a container that shares
    // `age-postgres`'s network namespace, where `127.0.0.1:5432` IS AGE's own
    // store — so the script must build that authority once, to rewrite the owner
    // URL onto the container route.
    //
    // 🚫 **AND ON THE HOST THAT SAME STRING IS A PEER'S DATABASE.** SNARA's
    // postgres is what `127.0.0.1:5432` means outside the namespace, which is
    // why `AGE_DB_HOST_PORT=5432` is refused by name two tests below. So the
    // rule is narrowed rather than dropped: every occurrence must be a COMPLETE
    // authority in the container rewrite (`@…/`), 🚫 never a bare host:port that
    // could be pasted into anything host-side.
    const occurrences = SCRIPT_BODY.match(/127\.0\.0\.1:5432/g) ?? [];
    const authorities = SCRIPT_BODY.match(/@127\.0\.0\.1:5432\//g) ?? [];
    expect(occurrences).toHaveLength(2);
    expect(authorities).toHaveLength(occurrences.length);
    // ⚠️ And the rewrite must FAIL CLOSED, or an unrewritten URL would migrate
    // through the host port again and still report success.
    expect(SCRIPT).toContain(
      'REFUSED: AGE_DB_OWNER_URL could not be rewritten to the container route.',
    );
  });

  it('refuses 5432 by name', () => {
    expect(SCRIPT_BODY).toContain('AGE_DB_HOST_PORT" = "5432"');
    expect(SCRIPT).toContain('REFUSED: AGE_DB_HOST_PORT is 5432.');
  });

  it('refuses an owner URL that addresses somebody else', () => {
    // ⚠️ A migration applied to the wrong instance does not report itself: it
    // creates AGE's tables inside a peer's database and then works.
    expect(SCRIPT).toContain('REFUSED: AGE_DB_OWNER_URL addresses port 5432.');
    expect(SCRIPT).toContain("REFUSED: AGE_DB_OWNER_URL does not address AGE's own store.");
  });

  it('defaults nothing it requires', () => {
    for (const variable of [
      'AGE_DB_NAME',
      'AGE_DB_SUPERUSER',
      'AGE_DB_SUPERUSER_PASSWORD',
      'AGE_DB_APP_PASSWORD',
      'AGE_DB_HOST_PORT',
      'AGE_DB_OWNER_URL',
      'AGE_STUDIO_ORGANIZATION_ID',
    ]) {
      expect(SCRIPT_BODY, variable).toContain(`require ${variable}`);
    }
  });

  it('applies the committed migrations and 🚫 never authors new ones', () => {
    // 🚫 `migrate dev` would write SQL nobody reviewed onto a real store.
    //
    // ⚠️ **THE OPERATION MOVED; THE GUARD FOLLOWED IT** — the same thing ADR-0077
    // did when the root half of the deploy went into wrappers. ADR-0078 C1 runs
    // migrations in the `migrate` compose service instead of on the host, because
    // while they ran against the published port C3 could not have removed that
    // publication at all. 🚫 Asserting only one end would let the operation be
    // deleted at the other.
    expect(SCRIPT_BODY).toContain('docker-compose.age-migrate.yml');
    expect(SCRIPT_BODY).toContain('run --rm migrate');
    expect(MIGRATE_COMPOSE_BODY).toContain("'prisma:migrate:deploy'");
    expect(SCRIPT_BODY).not.toContain('migrate dev');
    expect(MIGRATE_COMPOSE_BODY).not.toContain('migrate dev');
    expect(MIGRATE_COMPOSE_BODY).not.toContain('migrate:dev');
  });

  it('runs the console as the NON-OWNER role, with RLS applying to it', () => {
    // ⚠️ The attributes are the ci-db.yml ones verbatim — 🚫 no drift between
    // what CI proves and what production runs. NOBYPASSRLS is the one that keeps
    // the row-level policies applying to this connection at all.
    expect(SCRIPT_BODY).toContain('LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
    expect(SCRIPT_BODY).toContain('DATABASE_URL_APP=postgresql://age_app:');
  });

  it('🚫 never writes the owner connection into the service environment', () => {
    // ⚠️ The env file the unit reads carries the app role and the organization,
    // and nothing else. An application holding owner credentials is exempt from
    // every policy while it drops a table by accident.
    // ⚠️ Anchored on the WRITE, not on the first mention of the path — the
    // filename appears near the top as a variable, long before the owner URL is
    // used for the migration, and a slice taken from there would contain it.
    const envWrite = SCRIPT_BODY.slice(SCRIPT_BODY.indexOf('DATABASE_URL_APP=postgresql'));
    expect(envWrite.length).toBeGreaterThan(50);
    expect(envWrite).not.toContain('AGE_DB_OWNER_URL');
    expect(envWrite).not.toContain('AGE_DB_SUPERUSER_PASSWORD');
  });

  it('🛑 exposes nothing — ADR-0074 D9', () => {
    // 🚫 A database is a store, not a door. The public bind, the TLS vhost and
    // the hostname are the LAST slice, and the owner said so again when they
    // accepted ADR-0075.
    for (const token of ['caddy', 'nginx', 'certbot', 'ufw allow']) {
      expect(SCRIPT_BODY.toLowerCase(), token).not.toContain(token);
    }
    // ⚠️ `0.0.0.0` IS NOT ON THAT LIST, ON PURPOSE. The script contains it —
    // inside the check that REFUSES a container publishing off loopback. A scan
    // that banned the string outright would have deleted the guard against the
    // very thing it was meant to catch.
    expect(SCRIPT_BODY).toContain('REFUSED: ${CONTAINER} publishes a port off loopback.');
  });
});

/**
 * 🛑 **NO CREDENTIAL IN A REMOTE COMMAND LINE.**
 *
 * ⚠️ **THIS ONE SHIPPED, AND ITS COMMENT SAID THE OPPOSITE.** Every remote step
 * used to read `ssh host "PGPASSWORD='…' bash -s"`, above a comment asserting
 * that "every credential is passed to the remote side through an environment
 * variable, so none appears in a remote argv". The string IS the remote shell's
 * argv: for as long as each step ran, the superuser password, the application
 * role's password and the OWNER connection string were readable from `ps` by
 * every other user on a host AGE shares with three peer products.
 *
 * 🚫 Nothing was logged and nothing looked wrong, which is why a source review
 * passed over it — the exposure is in the *shape* of the call, not its output.
 *
 * ⚠️ The rule is asserted as **exactly one `ssh` call site**, 🚫 not as "no
 * secret appears near one": a second call site is where the next secret goes.
 */
describe('the provisioning script keeps secrets off the remote command line', () => {
  /** Every credential this script handles, by the name it travels under. */
  const CREDENTIALS: readonly string[] = [
    'AGE_DB_SUPERUSER_PASSWORD',
    'AGE_DB_APP_PASSWORD',
    'AGE_DB_OWNER_URL',
    'PGPASSWORD',
    'DATABASE_URL',
  ];

  /**
   * Every line that invokes ssh, however it is spelled.
   *
   * ⚠️ Trimmed, because this repository is developed on Windows and the working
   * copy carries CRLF: an assertion that compared raw lines would fail for a
   * reason that has nothing to do with what it is guarding.
   */
  const sshLines = bodyLines(SCRIPT)
    .map((line) => line.trimEnd())
    .filter((line) => /\bssh\b|\$\{SSH\[@\]\}/.test(line));

  it('finds ssh call sites at all, so an empty scan can never report compliance', () => {
    expect(sshLines.length).toBeGreaterThan(0);
  });

  it('reaches the server through ONE helper, and 🚫 nowhere else', () => {
    // ⚠️ Two lines and no more: the array that builds the command, and the
    // single pipe inside `remote()` that consumes it.
    expect(
      sshLines,
      'A second ssh call site is a second place a secret can be put by mistake. Route it ' +
        'through remote() instead.',
    ).toEqual([
      'SSH=(ssh -p "$AGE_VPS_PORT" "${AGE_VPS_USER}@${AGE_VPS_HOST}")',
      '  } | "${SSH[@]}" bash -s',
    ]);
  });

  it('passes the assignments down stdin, 🚫 never as arguments', () => {
    // 🛑 `bash -s` reads its program from stdin, so exported assignments
    // prepended to the heredoc are part of that program and never exist as
    // argv. 🚫 A `remote()` that took a command string would defeat this.
    expect(SCRIPT_BODY).toContain("printf 'export %s=%q\\n'");
    expect(SCRIPT_BODY).toContain('| "${SSH[@]}" bash -s');
  });

  it('names no credential on an ssh line', () => {
    let examined = 0;

    for (const line of sshLines) {
      for (const credential of CREDENTIALS) {
        examined += 1;
        expect(
          line,
          `${credential} appears on an ssh line. A remote command line is readable from ps by ` +
            `every other user on that host.`,
        ).not.toContain(credential);
      }
    }

    // ⚠️ Count what was examined, so the loop above can never pass silently.
    expect(examined).toBe(sshLines.length * CREDENTIALS.length);
  });
});
