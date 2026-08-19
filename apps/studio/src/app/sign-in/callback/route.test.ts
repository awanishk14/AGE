import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Completing a sign-in — ADR-0079 §6 slice 3.
 *
 * 🛑 **THIS IS NOW THE ONE ROUTE AN UNAUTHENTICATED CALLER ON THE PUBLIC
 * INTERNET CAN REACH THAT DOES ANYTHING**, and it inherits the question the
 * retired paste-a-token route was made to answer: *what happens when the input
 * is nonsense?* ⚠️ MEASURED THERE ONCE: a 500, because a malformed body threw.
 * A 500 is the answer an attacker works to provoke — it is where stack traces
 * come from — and it is also simply wrong: nothing failed, a caller sent
 * rubbish.
 *
 * 🛑 **AND THE SECOND QUESTION IS NEW AND BIGGER: HOW FAR DOES A FORGED CALLBACK
 * GET?** This route can spend a request on Google and can insert the one row AGE
 * is authorized to insert. So the assertions below are not only about the
 * ANSWER; they are about WHAT WAS NOT REACHED on the way to it.
 *
 * ⚠️ Every fixture is obviously fictional. 🚫 No real operator, organization,
 * address or client identifier appears here.
 */

const STATE = 'a'.repeat(64);
const NONCE = 'b'.repeat(64);
const CLIENT_ID = 'client-fictional.apps.googleusercontent.invalid';
const ORGANIZATION = 'organization-fictional-alpha';
const EMAIL = 'operator@example.invalid';
const NOW = new Date('2026-08-18T10:00:00.000Z');

const world = vi.hoisted(() => ({
  configured: true,
  exchanges: [] as string[],
  idToken: undefined as string | undefined,
  directoryReads: [] as { organizationId: string; email: string }[],
  entry: {} as unknown,
  issued: [] as { organizationId: string; accountId: string; token: string }[],
  minted: 'c'.repeat(64),
}));

vi.mock('@/server/operator-environment', () => ({
  googleSignInConfiguration: () =>
    world.configured
      ? {
          clientId: CLIENT_ID,
          clientSecret: 'secret-fictional-never-real',
          redirectUri: 'https://console.example.invalid/sign-in/callback',
        }
      : undefined,
  sessionLookupOrganizationId: () => (world.configured ? ORGANIZATION : undefined),
  signInNow: () => NOW,
  mintOpaqueValue: () => world.minted,
  exchangeGoogleAuthorizationCode: async (_configuration: unknown, code: string) => {
    world.exchanges.push(code);
    return world.idToken;
  },
  readSignInDirectoryEntry: async (organizationId: string, email: string) => {
    world.directoryReads.push({ organizationId, email });
    return world.entry;
  },
  issueOperatorSession: async (organizationId: string, accountId: string, token: string) => {
    world.issued.push({ organizationId, accountId, token });
    return { sessionId: 'session-fictional-1', expiresAt: '2026-08-18T18:00:00.000Z' };
  },
}));

const { GET } = await import('./route');

/** ⚠️ A well-formed Google id token, assembled rather than mocked. */
function idTokenWith(claims: Readonly<Record<string, unknown>>): string {
  const payload = Buffer.from(
    JSON.stringify({
      aud: CLIENT_ID,
      iss: 'https://accounts.google.com',
      exp: Math.floor(NOW.getTime() / 1000) + 300,
      nonce: NONCE,
      email: EMAIL,
      email_verified: true,
      sub: 'google-subject-fictional',
      ...claims,
    }),
    'utf8',
  )
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_');

  return `header.${payload}.signature`;
}

const HANDSHAKE = `__Host-age_signin_state=${STATE}; __Host-age_signin_nonce=${NONCE}`;

/**
 * ⚠️ `null` means NO `Cookie` HEADER AT ALL. 🚫 Not `undefined` — a default
 * parameter cannot tell "omitted" from "deliberately absent", and this helper
 * quietly supplied a VALID handshake for the no-cookie case until it was made
 * to fail: the test then reported the route ADMITTING a caller and read as a
 * route defect. A fixture that fills in the very thing under test proves the
 * opposite of what it claims.
 */
function callback(query: string, cookie: string | null = HANDSHAKE): Promise<Response> {
  return GET(
    new Request(`https://console.example.invalid/sign-in/callback${query}`, {
      headers: cookie === null ? {} : { cookie },
    }),
  );
}

function sessionCookie(response: Response): string | undefined {
  return response.headers.getSetCookie().find((value) => value.startsWith('__Host-age_session='));
}

beforeEach(() => {
  world.configured = true;
  world.exchanges.length = 0;
  world.directoryReads.length = 0;
  world.issued.length = 0;
  world.idToken = idTokenWith({});
  world.entry = {
    account: { accountId: 'account-fictional-operator', email: EMAIL, disabledAt: null },
    memberships: [
      {
        membershipId: 'membership-fictional-1',
        accountId: 'account-fictional-operator',
        scopeKind: 'agency',
        organizationId: ORGANIZATION,
        clientId: null,
        roleBundle: 'agency-operator',
        revokedAt: null,
      },
    ],
  };
});

describe('🛑 a forged or malformed callback is refused, 🚫 never a 500', () => {
  // ⚠️ `cookie: null` means NO `Cookie` HEADER AT ALL, which is a different
  // request from one carrying an unrelated cookie — and `undefined` could not
  // say so, because an omitted property and an explicit one read the same.
  const HOSTILE: readonly {
    readonly label: string;
    readonly query: string;
    readonly cookie?: string | null;
  }[] = [
    { label: 'no query string at all', query: '', cookie: HANDSHAKE },
    { label: 'no handshake cookie', query: `?state=${STATE}&code=abc`, cookie: 'other=1' },
    { label: 'no cookie header at all', query: `?state=${STATE}&code=abc`, cookie: null },
    { label: 'a mismatched state', query: `?state=${'d'.repeat(64)}&code=abc` },
    { label: 'no state', query: '?code=abc' },
    { label: 'no code', query: `?state=${STATE}` },
    { label: 'an empty code', query: `?state=${STATE}&code=` },
    { label: "Google's own error", query: `?state=${STATE}&error=access_denied` },
    { label: 'a repeated state parameter', query: `?state=${STATE}&state=x&code=abc` },
  ];

  it('answers every hostile shape with the SAME refusal', async () => {
    let examined = 0;

    for (const { label, query, cookie } of HOSTILE) {
      examined += 1;

      const response = await callback(query, cookie === undefined ? HANDSHAKE : cookie);

      expect(response.status, `${label} did not redirect`).toBe(303);
      expect(response.headers.get('Location'), `${label} answered differently`).toBe(
        '/sign-in?refused=1',
      );

      // 🛑 A REFUSAL HANDS OUT NO SESSION. The failure that would matter here is
      // one handed out on the way to saying no.
      expect(sessionCookie(response), `${label} set a session while refusing`).toBeUndefined();
    }

    // ⚠️ Asserted after the loop: a list that silently emptied would otherwise
    // report compliance without examining anything.
    expect(examined).toBe(HOSTILE.length);
  });

  it('🛑 spends NOTHING on a callback that fails a local check', async () => {
    for (const { query, cookie } of HOSTILE) {
      await callback(query, cookie === undefined ? HANDSHAKE : cookie);
    }

    // 🛑 THE POINT. A forged callback must not cost a request to Google, and must
    // never reach the database — an unauthenticated caller who can make this
    // console open a connection per request has a lever whatever it answers.
    expect(world.exchanges).toEqual([]);
    expect(world.directoryReads).toEqual([]);
    expect(world.issued).toEqual([]);
  });

  it('refuses with the HOST marker when the console is not configured', async () => {
    world.configured = false;

    const response = await callback(`?state=${STATE}&code=abc`);

    expect(response.headers.get('Location')).toBe('/sign-in?refused=not-configured');
  });
});

describe('🚫 an identity Google did not vouch for admits nobody', () => {
  it.each([
    ['a token the exchange never produced', () => (world.idToken = undefined)],
    ['a malformed token', () => (world.idToken = 'not-a-token')],
    ['a token for another audience', () => (world.idToken = idTokenWith({ aud: 'someone-else' }))],
    ['a replayed nonce', () => (world.idToken = idTokenWith({ nonce: 'e'.repeat(64) }))],
    ['an unverified email', () => (world.idToken = idTokenWith({ email_verified: false }))],
    [
      'an expired token',
      () => (world.idToken = idTokenWith({ exp: Math.floor(NOW.getTime() / 1000) - 1 })),
    ],
  ])('refuses %s and 🚫 never reaches the directory', async (_label, break_) => {
    break_();

    const response = await callback(`?state=${STATE}&code=abc`);

    expect(response.headers.get('Location')).toBe('/sign-in?refused=1');
    expect(world.directoryReads).toEqual([]);
    expect(world.issued).toEqual([]);
  });
});

describe('🛑 AGE mints nothing — a verified identity with no row is refused', () => {
  it.each([
    ['not-provisioned', { account: undefined, memberships: [] }],
    [
      'not-provisioned',
      {
        account: { accountId: 'account-fictional-operator', email: EMAIL, disabledAt: null },
        memberships: [],
      },
    ],
    [
      'ambiguous',
      {
        account: { accountId: 'account-fictional-operator', email: EMAIL, disabledAt: null },
        memberships: [1, 2].map((n) => ({
          membershipId: `membership-fictional-${n}`,
          accountId: 'account-fictional-operator',
          scopeKind: 'agency',
          organizationId: ORGANIZATION,
          clientId: null,
          roleBundle: `agency-role-${n}`,
          revokedAt: null,
        })),
      },
    ],
    [
      'scope-not-served',
      {
        account: { accountId: 'account-fictional-operator', email: EMAIL, disabledAt: null },
        memberships: [
          {
            membershipId: 'membership-fictional-1',
            accountId: 'account-fictional-operator',
            scopeKind: 'client',
            organizationId: ORGANIZATION,
            clientId: 'client-fictional-1',
            roleBundle: 'client-viewer',
            revokedAt: null,
          },
        ],
      },
    ],
  ])('answers `%s` and issues NOTHING', async (marker, entry) => {
    world.entry = entry;

    const response = await callback(`?state=${STATE}&code=abc`);

    expect(response.headers.get('Location')).toBe(`/sign-in?refused=${marker}`);
    // 🛑 THE INVARIANT THE WHOLE SLICE RESTS ON. A refused person gets no row —
    // and there is no path here that could give them the account they lack.
    expect(world.issued).toEqual([]);
    expect(sessionCookie(response)).toBeUndefined();
  });

  it('reads the directory in THIS deployment’s organization, by the verified address', async () => {
    await callback(`?state=${STATE}&code=abc`);

    // 🚫 The organization is the deployment's, 🚫 never a value from the callback
    // or from a claim — that is what stops a caller choosing whose directory
    // answers for them.
    expect(world.directoryReads).toEqual([{ organizationId: ORGANIZATION, email: EMAIL }]);
  });
});

describe('🛑 a platform operator is ADMITTED and still issued NOTHING (ADR-0082)', () => {
  it('refuses at this edge rather than filing the session under the pinned tenant', async () => {
    // 🛑 **THE FAILURE THIS PINS LOOKS LIKE A WORKING SIGN-IN.** Since ADR-0082
    // slice B, `decideSignIn` ADMITS a platform operator, with
    // `organizationId: null`. Issuance that can write a row without an
    // organization does not exist yet, and the one-character version of
    // shipping anyway — passing this deployment's pinned organization to
    // `issueOperatorSession` — would file a platform operator's session under a
    // TENANT. ⚠️ That is the substitution ADR-0082 D4 forbids, and 🚫 nothing
    // downstream would ever report it.
    world.entry = {
      account: { accountId: 'account-fictional-operator', email: EMAIL, disabledAt: null },
      memberships: [
        {
          membershipId: 'membership-fictional-platform',
          accountId: 'account-fictional-operator',
          scopeKind: 'platform',
          organizationId: null,
          clientId: null,
          roleBundle: 'platform-admin',
          revokedAt: null,
        },
      ],
    };

    const response = await callback(`?state=${STATE}&code=abc`);

    expect(response.headers.get('Location')).toBe('/sign-in?refused=scope-not-served');
    // 🛑 THE ASSERTION THAT MATTERS: 🚫 no row at all, and in particular 🚫 not
    // one carrying `ORGANIZATION`.
    expect(world.issued).toEqual([]);
    expect(sessionCookie(response)).toBeUndefined();
  });
});

describe('a provisioned operator is admitted, and the cookie matches the row', () => {
  it('issues one session and sets the cookie that points at it', async () => {
    const response = await callback(`?state=${STATE}&code=the-code`);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/');

    expect(world.exchanges).toEqual(['the-code']);
    expect(world.issued).toEqual([
      {
        organizationId: ORGANIZATION,
        accountId: 'account-fictional-operator',
        token: world.minted,
      },
    ]);

    // 🛑 THE COOKIE CARRIES THE SAME TOKEN THE ROW HASHED. If these ever differ,
    // sign-in "succeeds" and the very next request is refused — a failure whose
    // symptom is nowhere near its cause.
    expect(sessionCookie(response)).toContain(`__Host-age_session=${world.minted}`);
  });

  it('the session cookie expires WITH the row, 🚫 not on a lifetime of its own', async () => {
    // ⚠️ 10:00 issued, 18:00 expiry — ADR-0079 D4's eight hours, the owner's
    // answer. The cookie must not outlive it.
    const cookie = sessionCookie(await callback(`?state=${STATE}&code=abc`)) ?? '';

    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('🛑 spends the handshake, so the same callback cannot be replayed', async () => {
    const set = (await callback(`?state=${STATE}&code=abc`)).headers.getSetCookie();

    // 🚫 A `state` left in the browser is a `state` a later forged callback can
    // be matched against.
    expect(set.some((c) => c.startsWith('__Host-age_signin_state=;'))).toBe(true);
    expect(set.some((c) => c.startsWith('__Host-age_signin_nonce=;'))).toBe(true);
    expect(set.filter((c) => c.includes('Max-Age=0'))).toHaveLength(2);
  });

  it('clears the handshake on a REFUSAL too', async () => {
    const set = (await callback('?state=wrong&code=abc')).headers.getSetCookie();

    expect(set.filter((c) => c.includes('Max-Age=0'))).toHaveLength(2);
  });
});
