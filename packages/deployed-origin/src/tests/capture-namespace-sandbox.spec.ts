import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The capture CLI's route to AGE's store — ADR-0078 option C, slice C1.
 *
 * 🛑 **WHAT THIS GUARDS IS THE ONE PROPERTY THAT MADE OPTION C WORTH DOING.**
 * The capture chain reaches AGE's store by SHARING `age-postgres`'s network
 * namespace, so the URL it is handed still names a LOOPBACK address and
 * `assertLocalDatabaseTarget` (ADR-0061 A5, ADR-0075 D4) passes UNMODIFIED.
 *
 * ⚠️ **THE ALTERNATIVE THAT LOOKS EQUIVALENT AND IS NOT.** Attaching the capture
 * container to `age-internal` also reaches the store — and forces the URL to
 * name `172.23.0.2`, a BRIDGE address, which that guard refuses. The only way to
 * make it work is to widen the accepted host set, and a relaxed
 * `assertLocalDatabaseTarget` then admits ANY bridge address, including a peer's.
 * 🚫 **The boundary must never be bought by weakening the guard**, so these
 * assertions exist to make the substitution loud rather than quiet.
 *
 * 🚫 **AND WHAT THIS FILE DOES NOT PROVE.** Reading a compose file is not
 * reaching a socket, and a container that opens a TCP connection has not
 * captured anything. C2 proves the path by running the real workflow against the
 * real VPS; this guard only asserts the deployment still has the shape C2 proved.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const COMPOSE_PATH = join(REPO, 'deploy', 'vps', 'compose', 'docker-compose.age-capture.yml');
const ENTRYPOINT_PATH = join(REPO, 'apps', 'capture', 'docker-entrypoint.sh');
const DOCKERFILE_PATH = join(REPO, 'apps', 'studio', 'Dockerfile');
const PROVISION_PATH = join(REPO, 'scripts', 'provision-studio-database.sh');
const RUN_CAPTURE_PATH = join(REPO, 'scripts', 'run-capture.sh');
/**
 * ⚠️ **A SECOND COMPOSE FILE, AND THE SPLIT IS LOAD-BEARING.** Compose validates
 * EVERY service in a file, not only the one being run, so a `migrate` service
 * sitting beside `capture` was still interpolating the operator's workspace and
 * record paths — which a migration is deliberately never given. On the real box
 * that collapsed into `invalid spec: ::ro: empty section between colons`.
 * 🚫 The repair is not to export placeholder paths so validation passes.
 */
const MIGRATE_COMPOSE_PATH = join(
  REPO,
  'deploy',
  'vps',
  'compose',
  'docker-compose.age-migrate.yml',
);

const COMPOSE = readFileSync(COMPOSE_PATH, 'utf8');
const MIGRATE_COMPOSE = readFileSync(MIGRATE_COMPOSE_PATH, 'utf8');
const ENTRYPOINT = readFileSync(ENTRYPOINT_PATH, 'utf8');
const DOCKERFILE = readFileSync(DOCKERFILE_PATH, 'utf8');
const PROVISION = readFileSync(PROVISION_PATH, 'utf8');
const RUN_CAPTURE = readFileSync(RUN_CAPTURE_PATH, 'utf8');

/**
 * ⚠️ **THE FILES MUST BE NON-EMPTY BEFORE ANYTHING IS ASSERTED ABOUT THEM.**
 * §8's rule: a guard that reads nothing reports compliance. Every
 * `not.toContain` below would pass over an empty string.
 */
const SOURCES = {
  compose: COMPOSE,
  migrateCompose: MIGRATE_COMPOSE,
  entrypoint: ENTRYPOINT,
  dockerfile: DOCKERFILE,
  provision: PROVISION,
  runCapture: RUN_CAPTURE,
} as const;

/**
 * ⚠️ **COMMENTS ARE STRIPPED BEFORE ANY BANNED-TOKEN SCAN.** Every file here
 * explains the rule it obeys, and a file's own explanation matches the token it
 * forbids (`vitest-worker-cap.spec.ts` learned this the hard way).
 */
const withoutComments = (body: string): string =>
  body
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

const COMPOSE_CODE = withoutComments(COMPOSE);
/**
 * ⚠️ **THE PROVISION SCRIPT MUST BE STRIPPED TOO, AND THE FIRST RUN PROVED IT.**
 * `expect(PROVISION_CODE).not.toContain('sudo -E')` FAILED — on the comment that
 * tells the next reader not to write `sudo -E`. 🚫 A file's own explanation of a
 * rule matches the token the rule forbids.
 */
const PROVISION_CODE = withoutComments(PROVISION);
const RUN_CAPTURE_CODE = withoutComments(RUN_CAPTURE);
const MIGRATE_COMPOSE_CODE = withoutComments(MIGRATE_COMPOSE);

describe('the capture container reaches AGE’s store through the store’s own namespace', () => {
  it('reads every file it guards, and none of them is empty', () => {
    const names = Object.keys(SOURCES);
    expect(names).toHaveLength(6);
    for (const [name, body] of Object.entries(SOURCES)) {
      expect(body.length, `${name} was read as empty`).toBeGreaterThan(200);
    }
  });

  it('joins age-postgres’s namespace, exactly', () => {
    // 🛑 THE ONE LINE THAT DECIDES REACHABILITY. A different container name, or
    // an `age-internal` attachment in its place, changes what the capture chain
    // may address and nothing else in the repo would report it.
    expect(COMPOSE_CODE).toContain("network_mode: 'container:age-postgres'");
  });

  it('declares no networks and publishes no port', () => {
    // 🚫 `networks:` is what compose would demand if `network_mode` were
    // removed, so its absence is the assertion that keeps the substitution from
    // being made quietly. 🚫 A capture run is outbound; it listens for nothing.
    expect(COMPOSE_CODE).not.toContain('networks:');
    expect(COMPOSE_CODE).not.toContain('ports:');
  });

  it('is a one-shot act, not a restarting service', () => {
    // 🛑 ADR-0069: a capture is an ACT. 🚫 No scheduler, no poll, no bulk arm.
    expect(COMPOSE_CODE).not.toContain('restart:');
    expect(COMPOSE_CODE).not.toContain('container_name:');
  });

  it('never takes a credential from an env_file or a literal', () => {
    // ⚠️ ADR-0076 D6. The derived env file arrives as a read-only MOUNT, which
    // the daemon performs — 🚫 not as an `env_file:`, which compose reads
    // client-side, and 🚫 not as a value written into this file.
    expect(COMPOSE_CODE).not.toContain('env_file:');
    expect(COMPOSE_CODE).not.toContain('postgresql://');
    expect(COMPOSE_CODE).toContain(
      '/etc/age-studio/age-studio.container.env:/run/age/provisioned.env:ro',
    );
  });

  it('runs as the owner of the operator’s record file, never as a literal uid', () => {
    // 🚫 The repair for a permission fault on a real client's 0600 record is
    // never `chmod o+r` — it is matching the uid that already owns it.
    expect(COMPOSE_CODE).toContain("user: '${AGE_STUDIO_UID}:${AGE_STUDIO_GID}'");
    expect(RUN_CAPTURE).toContain('stat -c %u "$AGE_VPS_CLIENT_RECORD_FILE"');
    expect(RUN_CAPTURE).toContain('capture must not run as root');
  });

  it('mounts the operator’s two paths read-only and nothing else', () => {
    expect(COMPOSE_CODE).toContain(
      '${AGE_VPS_DISCOVERY_WORKSPACE}:${AGE_VPS_DISCOVERY_WORKSPACE}:ro',
    );
    expect(COMPOSE_CODE).toContain(
      '${AGE_VPS_CLIENT_RECORD_FILE}:${AGE_VPS_CLIENT_RECORD_FILE}:ro',
    );
    // ⚠️ Three mounts, all `:ro`. Count them, so a fourth cannot arrive unseen.
    // ⚠️ Anchored on a mount SOURCE (`/…` or `${…}`) — the first version of this
    // line also counted `- no-new-privileges:true`, which is not a mount.
    const mounts = COMPOSE_CODE.match(/^\s+- (?:\/|\$\{)\S+:\S+$/gm) ?? [];
    expect(mounts).toHaveLength(3);
    expect(mounts.filter((mount) => mount.trimEnd().endsWith(':ro'))).toHaveLength(3);
  });
});

describe('the migration reaches the same store the same way, from its own file', () => {
  /**
   * 🛑 **THE SPLIT IS THE FIX FOR A REAL FAILURE, 🚫 NOT TIDINESS.** With
   * `migrate` beside `capture`, `docker compose run --rm migrate` still
   * interpolated and validated the capture service's mounts — the operator's
   * workspace and record file, which a migration is deliberately never given —
   * and the run died on `invalid spec: ::ro: empty section between colons`.
   */
  it('joins the same namespace and declares no networks or ports', () => {
    expect(MIGRATE_COMPOSE_CODE).toContain("network_mode: 'container:age-postgres'");
    expect(MIGRATE_COMPOSE_CODE).not.toContain('networks:');
    expect(MIGRATE_COMPOSE_CODE).not.toContain('ports:');
  });

  it('is given no operator path at all, which is why it needed its own file', () => {
    // 🚫 No volumes, and 🚫 no interpolation of an operator path — the two
    // together are what let this run without the capture caller's environment.
    expect(MIGRATE_COMPOSE_CODE).not.toContain('volumes:');
    expect(MIGRATE_COMPOSE_CODE).not.toContain('AGE_VPS_DISCOVERY_WORKSPACE');
    expect(MIGRATE_COMPOSE_CODE).not.toContain('AGE_VPS_CLIENT_RECORD_FILE');
    expect(MIGRATE_COMPOSE_CODE).not.toContain('AGE_STUDIO_UID');
  });

  it('holds the migration and the capture file holds no migration', () => {
    // ⚠️ Both ends, so the service cannot quietly reappear in both files.
    expect(MIGRATE_COMPOSE_CODE).toContain('migrate:');
    expect(COMPOSE_CODE).not.toContain('migrate:');
    expect(COMPOSE_CODE).not.toContain('prisma:migrate:deploy');
  });

  it('never takes a credential from an env_file or a literal', () => {
    expect(MIGRATE_COMPOSE_CODE).not.toContain('env_file:');
    expect(MIGRATE_COMPOSE_CODE).not.toContain('postgresql://');
  });
});

describe('the container route is computed in the namespace and never persisted', () => {
  it('rewrites whatever authority the file names to the namespace route', () => {
    expect(ENTRYPOINT).toContain("CONTAINER_HOST='127.0.0.1:5432'");
    expect(ENTRYPOINT).toContain('s#@[^@/]+:[0-9]+/#@${CONTAINER_HOST}/#');
  });

  it('refuses rather than falling back when the rewrite does not take', () => {
    // ⚠️ FAIL CLOSED. A silent fallback would run the capture through whatever
    // the file happened to name — on this host, possibly a PEER's postgres.
    expect(ENTRYPOINT).toContain('REFUSED: the provisioned DATABASE_URL_APP does not name');
    expect(ENTRYPOINT).toContain('REFUSED: DATABASE_URL_APP is absent');
    expect(ENTRYPOINT).toContain('REFUSED: the provisioned env file is not mounted');
  });

  it('never prints the URL it refuses', () => {
    // 🚫 A refusal names a POSITION, never the record's contents (ADR-0053 D4).
    expect(ENTRYPOINT).not.toContain('echo "$container_url"');
    expect(ENTRYPOINT).not.toContain('echo "$provisioned_url"');
  });

  it('does not hand the capture chain an owner connection', () => {
    // 🛑 The capture chain connects as the NON-OWNER role only (ADR-0046 D4).
    // An owner URL in this environment would satisfy `DATABASE_URL` and silently
    // disable every row-level policy.
    expect(ENTRYPOINT).toContain('unset DATABASE_URL');
  });
});

describe('provisioning and migrations left the host publication behind', () => {
  it('applies migrations through the namespace, not the host port', () => {
    // 🛑 THE REASON THIS IS PART OF C1. While migrations ran on the host against
    // the published port, C3 could not have removed that publication at all.
    // ⚠️ Two substrings rather than one spanning the line break: the checkout is
    // CRLF on this platform, so a `\n` in the expected text does not match.
    expect(PROVISION_CODE).toContain('docker-compose.age-migrate.yml');
    expect(PROVISION_CODE).toContain('run --rm migrate');
    expect(PROVISION_CODE).not.toMatch(
      /^\s*pnpm --filter @age\/persistence prisma:migrate:deploy\s*$/m,
    );
  });

  it('rewrites the owner URL to the container route and refuses if it cannot', () => {
    expect(PROVISION_CODE).toContain("sed -E 's#@[^@/]+:[0-9]+/#@127.0.0.1:5432/#'");
    expect(PROVISION_CODE).toContain(
      'REFUSED: AGE_DB_OWNER_URL could not be rewritten to the container route.',
    );
  });

  it('never lets the owner credential become an argument', () => {
    // ⚠️ #350: a command line is public on a host shared with four products.
    // `--preserve-env=<NAME>` forwards exactly one value; 🚫 `sudo -E` would
    // forward every other credential this script is holding.
    expect(PROVISION_CODE).toContain('sudo --preserve-env=AGE_DB_OWNER_URL_CONTAINER');
    expect(PROVISION_CODE).not.toContain('sudo -E');
    expect(MIGRATE_COMPOSE_CODE).toContain('DATABASE_URL: ${AGE_DB_OWNER_URL_CONTAINER:?');
  });

  it('applies the committed migrations and never authors new ones', () => {
    // 🛑 `migrate deploy`, 🚫 never `migrate dev` — this store holds a real
    // business's snapshots and `dev` may reset it.
    expect(MIGRATE_COMPOSE_CODE).toContain("'prisma:migrate:deploy'");
    expect(MIGRATE_COMPOSE_CODE).not.toContain('migrate:dev');
  });
});

describe('the owner account reaches the deploy path without owning it', () => {
  /**
   * 🛑 **THE DEFECT THIS EXISTS TO PREVENT WAS REAL, AND ONLY THE VPS FOUND IT.**
   * Since ADR-0077 the checkout is `/home/age-deploy/age` and
   * `/var/lib/age-operator` is mode 700, both owned by `age-deploy`. Both scripts
   * run as the OWNER account, which is deliberately NOT that account — so a
   * `cd "$AGE_VPS_PATH"` or a bare `stat` on the record file is a permission
   * denial, and every local gate and CI run passed straight over it.
   *
   * 🚫 **THE REPAIR IS NEVER TO WIDEN A MODE OR MOVE THE FILES BACK.** The
   * separation is ADR-0077's whole point. These assertions pin the repair that
   * was actually made: reach them as root for exactly the facts needed.
   */
  it('never changes into the deploy path it cannot traverse', () => {
    expect(PROVISION_CODE).not.toMatch(/^\s*cd "\$AGE_VPS_PATH"\s*$/m);
    expect(RUN_CAPTURE_CODE).not.toMatch(/^\s*cd "\$AGE_VPS_PATH"\s*$/m);
  });

  it('names the compose file absolutely and supplies the project directory', () => {
    // ⚠️ `--project-directory` replaces the base compose would otherwise have
    // taken from the working directory — 🚫 without it, relative paths inside
    // the compose file would resolve against the caller's home.
    expect(RUN_CAPTURE_CODE).toContain(
      'CAPTURE_COMPOSE="${AGE_VPS_PATH}/deploy/vps/compose/docker-compose.age-capture.yml"',
    );
    expect(RUN_CAPTURE_CODE).toContain('docker compose -f "$CAPTURE_COMPOSE" --project-directory');
    expect(PROVISION_CODE).toContain(
      'MIGRATE_COMPOSE="${AGE_VPS_PATH}/deploy/vps/compose/docker-compose.age-migrate.yml"',
    );
    expect(PROVISION_CODE).toContain('docker compose -f "$MIGRATE_COMPOSE" --project-directory');
  });

  it('refuses when the deployment predates C1 rather than failing obscurely', () => {
    // ⚠️ `network_mode: container:…` and a missing compose file both fail with
    // messages that name neither cause. The refusal is stated here instead.
    expect(RUN_CAPTURE_CODE).toContain('sudo test -r "$CAPTURE_COMPOSE"');
    expect(RUN_CAPTURE_CODE).toContain('REFUSED: the capture compose file is not present at');
    expect(PROVISION_CODE).toContain('sudo test -r "$MIGRATE_COMPOSE"');
    expect(PROVISION_CODE).toContain('REFUSED: the migrate compose file is not present at');
  });

  it('reads the operator’s record as root, never as the owner directly', () => {
    // 🚫 A bare `stat` here is the defect, not a simplification.
    expect(RUN_CAPTURE_CODE).toContain('sudo stat -c %u "$AGE_VPS_CLIENT_RECORD_FILE"');
    expect(RUN_CAPTURE_CODE).toContain('sudo stat -c %g "$AGE_VPS_CLIENT_RECORD_FILE"');
    expect(RUN_CAPTURE_CODE).not.toMatch(/[^o] stat -c %[ug] "\$AGE_VPS_CLIENT_RECORD_FILE"/);
  });
});

describe('the image actually carries the binary the entrypoint execs', () => {
  it('builds @age/capture, because apps/capture/dist is not tracked', () => {
    expect(DOCKERFILE).toContain('RUN pnpm --filter @age/capture build');
    expect(ENTRYPOINT).toContain('/age/apps/capture/dist/bin/age-capture.cjs');
  });

  it('is executed through sh, so a missing exec bit cannot break the deploy', () => {
    // ⚠️ The repo is developed on Windows, where `+x` does not survive.
    expect(COMPOSE_CODE).toContain(
      "entrypoint: ['/bin/sh', '/age/apps/capture/docker-entrypoint.sh']",
    );
  });

  it('reuses the console’s own image rather than a second copy of the same code', () => {
    expect(COMPOSE_CODE).toContain('image: age-studio:local');
    expect(COMPOSE_CODE).not.toContain('dockerfile:');
  });
});

describe('the entrypoint survives being shipped from a Windows checkout', () => {
  /**
   * 🛑 **THE THIRD DEFECT THAT ONLY THE REAL BOX COULD FIND.** The entrypoint is
   * the first shell script AGE executes INSIDE a Linux container, and it died
   * there with `set: Illegal option -` — not a syntax error, a carriage return.
   * This repo is developed on Windows, git checked the file out CRLF, and
   * `rsync` shipped those bytes verbatim; to `dash` the `\r` is part of the
   * token. 🚫 The repair is not `dos2unix` on the box or `sed -i` in the
   * Dockerfile — both leave the committed bytes wrong.
   */
  const GITATTRIBUTES = readFileSync(join(REPO, '.gitattributes'), 'utf8');

  it('declares LF for every shell script, once, for the whole repository', () => {
    expect(GITATTRIBUTES.length).toBeGreaterThan(0);
    expect(GITATTRIBUTES).toContain('*.sh text eol=lf');
  });

  it('carries no carriage return in the file dash actually executes', () => {
    // ⚠️ Read as BYTES. A `utf8` read still contains the `\r`, but reading the
    // buffer says plainly that this assertion is about what ships, not about
    // what an editor displays.
    const bytes = readFileSync(ENTRYPOINT_PATH);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.includes(0x0d)).toBe(false);
  });

  it('holds the same rule for the script that invokes it', () => {
    const bytes = readFileSync(RUN_CAPTURE_PATH);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.includes(0x0d)).toBe(false);
  });
});
