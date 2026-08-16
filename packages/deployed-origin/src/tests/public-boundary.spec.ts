import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The public boundary — ADR-0074 §7 slice 4.
 *
 * 🛑 **THE ARTIFACTS SCANNED HERE ARE THE ONLY THING BETWEEN THE INTERNET AND A
 * CONSOLE THAT HOLDS A REAL CLIENT'S INTELLIGENCE.** Every other guard in this
 * repository protects a decision inside the application. This one protects the
 * sentence *"nothing reaches the console except through TLS, and the console is
 * not otherwise reachable"* — and that sentence lives in a config file, not in
 * TypeScript, so no typechecker will ever notice it becoming false.
 *
 * ⚠️ **WHAT MAKES THIS GUARD WORTH HAVING IS THE SHAPE OF ITS FAILURE.** A vhost
 * that proxies to the wrong upstream, or drops `always` from a header, or grows
 * one `Access-Control-Allow-Origin`, is still a VALID nginx config. It reloads
 * cleanly, the site keeps working, the browser shows a padlock, and every test
 * in this repository stays green. There is no moment at which anything looks
 * wrong.
 *
 * 🚫 **AND IT IS NOT A PROOF THAT THE DEPLOYED BOX MATCHES.** It asserts what
 * the operator will install; `scripts/expose-studio-public.sh` pipes THIS FILE
 * to the box precisely so those two cannot drift, and re-checks the loopback
 * bind after the reload. Neither fact is a substitute for looking at the running
 * server (ADR-0046 D5's habit, applied to a proxy).
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const VHOST_PATH = join(REPO, 'deploy', 'vps', 'nginx', 'age.digitaldadi.agency.conf');
const SCRIPT_PATH = join(REPO, 'scripts', 'expose-studio-public.sh');

const VHOST = readFileSync(VHOST_PATH, 'utf8');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');

/**
 * ⚠️ Comments come off before every scan. Both files EXPLAIN the rules they
 * obey, in prose containing the very tokens searched for — `-Server`,
 * `auth_basic`, `Access-Control-Allow-Origin` and `0.0.0.0` all appear in the
 * commentary above as things that must NOT appear in the body.
 */
function bodyLines(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => !line.trimStart().startsWith('#'));
}

const VHOST_BODY = bodyLines(VHOST).join('\n');
const SCRIPT_BODY = bodyLines(SCRIPT).join('\n');

describe('the artifacts exist and are actually being read', () => {
  it('finds a vhost and a script with content, so an empty scan can never report compliance', () => {
    expect(bodyLines(VHOST).length).toBeGreaterThan(20);
    expect(bodyLines(SCRIPT).length).toBeGreaterThan(20);
  });
});

describe('the console is reached ONLY through the proxy, on one internal name', () => {
  /** Every upstream this vhost is willing to speak to. */
  const upstreams = bodyLines(VHOST)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('proxy_pass '))
    .map((line) => line.replace(/^proxy_pass\s+/, '').replace(/;$/, ''));

  it('finds proxy_pass directives at all', () => {
    expect(upstreams.length).toBeGreaterThan(0);
  });

  it('proxies to the one console service and 🚫 nothing else', () => {
    // 🛑 A SECOND UPSTREAM IS A SECOND PRODUCT PUBLISHED UNDER AGE'S NAME AND
    // AGE'S CERTIFICATE. One mistyped name here would put a peer behind
    // age.digitaldadi.agency, with a valid padlock and no error anywhere.
    //
    // ⚠️ **AN INTERMEDIATE DRAFT MADE THIS `http://studio:3100`**, a Docker
    // service name on an AGE-owned proxy. 🚫 That proxy could not exist: the
    // host's nginx already owns 80/443 for five peer vhosts (ADR-0076 §0.4b).
    // The console is published on host loopback instead, so the upstream is a
    // host address again — and this equality is what stops it becoming a peer's.
    //
    // ⚠️ **DEDUPED, 🚫 NOT INDEXED.** The sign-in door is its own exact-match
    // location so it can carry a rate limit, and nginx locations do not inherit
    // `proxy_pass` — so the directive legitimately appears more than once. What
    // must hold is that every occurrence names the SAME upstream, which is
    // exactly what a set of size one says.
    expect([...new Set(upstreams)]).toEqual(['http://127.0.0.1:3100']);
    expect(upstreams.length).toBeGreaterThanOrEqual(2);
  });

  it('🚫 never proxies over plaintext port 80', () => {
    // ⚠️ The :80 server exists to serve the ACME challenge and redirect. If a
    // `proxy_pass` ever appears in it, the console is reachable over HTTP and
    // the session cookie travels in clear text exactly once — which is enough.
    const plaintextServer = VHOST_BODY.slice(VHOST_BODY.indexOf('listen 80;'));
    expect(plaintextServer).not.toContain('proxy_pass');
    expect(plaintextServer).toContain('return 301 https://$host$request_uri;');
  });

  it('serves the ACME challenge ABOVE the redirect, so renewal keeps working', () => {
    const plaintextServer = VHOST_BODY.slice(VHOST_BODY.indexOf('listen 80;'));
    const challenge = plaintextServer.indexOf('.well-known/acme-challenge');
    const redirect = plaintextServer.indexOf('return 301');
    expect(challenge).toBeGreaterThan(-1);
    expect(redirect).toBeGreaterThan(challenge);
  });
});

describe('the headers a browser needs, and 🚫 the one it must never get', () => {
  /**
   * ⚠️ Each of these is asserted WITH `always`. Without it nginx omits the
   * header on 4xx and 5xx — the responses an attacker works hardest to provoke,
   * and the ones a casual check of the home page never sees.
   */
  const REQUIRED: readonly string[] = [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
  ];

  it('sets every required header, always', () => {
    let examined = 0;
    for (const header of REQUIRED) {
      examined += 1;
      const directive = bodyLines(VHOST).find((line) =>
        line.trim().startsWith(`add_header ${header} `),
      );
      expect(directive, `${header} is not set at all`).toBeDefined();
      expect(
        directive,
        `${header} is set without \`always\`, so it is missing from every error response`,
      ).toMatch(/\balways;\s*$/);
    }
    expect(examined).toBe(REQUIRED.length);
  });

  it('forbids framing in the header that actually binds', () => {
    expect(VHOST_BODY).toContain("frame-ancestors 'none'");
    expect(VHOST_BODY).toContain("form-action 'self'");
    expect(VHOST_BODY).toContain("object-src 'none'");
    expect(VHOST_BODY).toContain("base-uri 'self'");
  });

  it('🚫 sets NO CORS header, anywhere', () => {
    // 🛑 The session cookie is SameSite=Strict and the console is same-origin
    // only. One `Access-Control-Allow-Origin` is the difference between "another
    // site cannot read this operator's console" and "it can".
    expect(VHOST_BODY).not.toMatch(/Access-Control-Allow-/i);
  });

  it('does not hand the caller its own X-Forwarded-Proto back', () => {
    // ⚠️ A client-supplied protocol is a claim, not evidence. It is overwritten
    // with the literal `https`, 🚫 never with `$http_x_forwarded_proto` and
    // 🚫 never with `$scheme` (which is `http` on the plaintext server).
    expect(VHOST_BODY).toContain('proxy_set_header X-Forwarded-Proto https;');
    expect(VHOST_BODY).not.toContain('$http_x_forwarded_proto');
  });
});

describe('the proxy is not, and must not become, the authentication', () => {
  /**
   * 🛑 ADR-0074 D3 puts the boundary INSIDE the application: a session row,
   * checked on every request, revoked on sign-out. A proxy-level password would
   * be a second, weaker answer to a question already answered — and the one that
   * gets relaxed first, because relaxing it breaks no test.
   */
  const REFUSED_BY_NAME: readonly string[] = ['auth_basic', 'auth_request', 'satisfy any'];

  it('names no proxy-level authentication mechanism', () => {
    let examined = 0;
    for (const mechanism of REFUSED_BY_NAME) {
      examined += 1;
      expect(
        VHOST_BODY,
        `${mechanism} would put a SECOND boundary in front of the real one`,
      ).not.toContain(mechanism);
    }
    expect(examined).toBe(REFUSED_BY_NAME.length);
  });

  it('gates nothing on the caller’s address', () => {
    // 🚫 An allow-list of IPs reads as security and is not: it fails open for
    // anyone behind the same edge, and it fails CLOSED for the operator on a
    // different network — which is the pressure that gets it removed in a hurry.
    expect(VHOST_BODY).not.toMatch(/^\s*(allow|deny)\s/m);
  });

  it('allows GET, HEAD and POST, and refuses everything else by default', () => {
    expect(VHOST_BODY).toContain('if ($request_method !~ ^(GET|HEAD|POST)$)');
    expect(VHOST_BODY).toContain('return 405;');
  });
});

describe('the exposure script refuses to publish an unprotected console', () => {
  it('checks the loopback bind BEFORE it installs anything', () => {
    const bindCheck = SCRIPT_BODY.indexOf('127.0.0.1:${AGE_STUDIO_PORT}');
    const install = SCRIPT_BODY.indexOf('sites-available');
    expect(bindCheck).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(bindCheck);
  });

  it('requires an unauthenticated protected route to redirect, 🚫 not to render', () => {
    expect(SCRIPT_BODY).toContain('/businesses');
    expect(SCRIPT_BODY).toContain('answered ${code} to an unauthenticated request');
  });

  it('requires a garbage credential to be refused before exposing anything', () => {
    expect(SCRIPT_BODY).toContain('token=not-a-real-token');
    expect(SCRIPT_BODY).toContain('/sign-in?refused=');
  });

  it('re-checks the bind AFTER the reload', () => {
    // ⚠️ The check that matters is the one taken after the change, not before
    // it. Two occurrences, and the second is downstream of the vhost install.
    const occurrences = SCRIPT_BODY.split('127.0.0.1:${AGE_STUDIO_PORT}').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('keeps secrets off the remote command line, like its neighbour', () => {
    // ⚠️ There is no secret in this script today. The helper exists so that
    // stays true if one ever appears — #350 removed exactly this defect from
    // scripts/provision-studio-database.sh, where a comment claimed it was
    // already absent.
    expect(SCRIPT_BODY).toContain("printf 'export %s=%q\\n'");
    expect(SCRIPT_BODY).toContain('| "${SSH[@]}" bash -s');
  });
});

describe('the sign-in door is rate limited, and 🚫 nothing else is', () => {
  // 🛑 **A TRANSPORT CONTROL, 🚫 A SECOND AUTHENTICATION.** ⚠️ MEASURED on the
  // live origin before this existed: 15 bad tokens submitted back to back all
  // answered `303`, with nothing at any layer counting them.

  it('declares a zone keyed on the one address a caller cannot choose', () => {
    expect(VHOST_BODY).toMatch(/limit_req_zone\s+\$binary_remote_addr\s+zone=age_signin:/);

    // 🚫 **NOT `CF-Connecting-IP`, AND NOT ANY OTHER REQUEST HEADER.** This
    // origin is reachable directly by IP, so a header-derived key is
    // attacker-supplied — and a key the attacker picks is not a limit.
    expect(VHOST_BODY).not.toMatch(/limit_req_zone\s+\$http_/);
  });

  it('applies the limit to the sign-in door by exact match', () => {
    expect(VHOST_BODY).toContain('location = /sign-in/submit {');

    const door = VHOST_BODY.slice(VHOST_BODY.indexOf('location = /sign-in/submit {'));
    expect(door.slice(0, door.indexOf('}'))).toContain('limit_req zone=age_signin');
  });

  it('answers 429, so a throttled caller learns nothing about the token', () => {
    // 🚫 A rate limit that answered differently for a correct token would leak
    // exactly what #353 refused to leak: request shape must stay
    // indistinguishable from credential correctness.
    expect(VHOST_BODY).toContain('limit_req_status 429;');
  });

  it('🚫 does not throttle the authenticated console itself', () => {
    // ⚠️ A limit on `location /` at a rate low enough to matter at the door
    // would lock a working operator out of their own console mid-session.
    const catchAll = VHOST_BODY.slice(VHOST_BODY.indexOf('location / {'));
    expect(catchAll.slice(0, catchAll.indexOf('\n    }'))).not.toContain('limit_req ');
  });
});
