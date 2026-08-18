import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Beginning a sign-in — ADR-0079 §6 slice 3.
 *
 * 🛑 **WHAT THIS FILE IS FOR: THE HANDSHAKE THE BROWSER IS SENT AWAY WITH MUST
 * BE THE ONE IT IS LATER CHECKED AGAINST.** A `state` in the URL that does not
 * match the `state` in the cookie is not a weaker CSRF defence, it is none —
 * and nothing else in this repository would notice, because both halves would
 * still be perfectly well-formed.
 */

const configuration = vi.hoisted(() => ({
  value: {
    clientId: 'client-fictional.apps.googleusercontent.invalid',
    clientSecret: 'secret-fictional-never-real',
    redirectUri: 'https://console.example.invalid/sign-in/callback',
  } as { clientId: string; clientSecret: string; redirectUri: string } | undefined,
  organizationId: 'organization-fictional-alpha' as string | undefined,
  minted: [] as string[],
}));

vi.mock('@/server/operator-environment', () => ({
  googleSignInConfiguration: () => configuration.value,
  sessionLookupOrganizationId: () => configuration.organizationId,
  // ⚠️ Distinct values per call, so a route that used ONE value for both `state`
  // and `nonce` fails here rather than shipping a handshake with half the
  // protection it claims.
  mintOpaqueValue: () => {
    const value = `${'0123456789abcdef'.repeat(4)}`.slice(0, 63) + configuration.minted.length;
    configuration.minted.push(value);
    return value;
  },
}));

const { POST } = await import('./route');

/** Every `Set-Cookie` on a response, as a browser would see them. 🚫 Not joined. */
function cookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

beforeEach(() => {
  configuration.minted.length = 0;
  configuration.organizationId = 'organization-fictional-alpha';
  configuration.value = {
    clientId: 'client-fictional.apps.googleusercontent.invalid',
    clientSecret: 'secret-fictional-never-real',
    redirectUri: 'https://console.example.invalid/sign-in/callback',
  };
});

describe('🛑 a console that cannot admit anybody says so, rather than trying', () => {
  it.each([
    ['no Google client', () => (configuration.value = undefined)],
    ['no organization', () => (configuration.organizationId = undefined)],
  ])('refuses with the HOST marker when there is %s', async (_label, break_) => {
    break_();

    const response = await POST();

    // ⚠️ The HOST's problem, named as such. A whole Google round trip that then
    // admits nobody reads to the operator as "Google rejected me".
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/sign-in?refused=not-configured');
    expect(cookies(response)).toEqual([]);
  });
});

describe('the handshake that is set is the handshake that is sent', () => {
  it('sends the browser to Google carrying exactly the two minted values', async () => {
    const response = await POST();

    expect(response.status).toBe(303);

    const location = response.headers.get('Location') ?? '';

    // 🛑 Google's endpoint is a CONSTANT from the pure package, 🚫 never a host
    // from the environment or from a response.
    expect(location.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);

    const sent = new URLSearchParams(location.slice(location.indexOf('?') + 1));
    const set = cookies(response);

    expect(configuration.minted).toHaveLength(2);
    // 🛑 TWO DIFFERENT VALUES. One value used twice would mean a `nonce` an
    // attacker learns from the `state` they were already given.
    expect(new Set(configuration.minted).size).toBe(2);

    expect(sent.get('state')).toBe(configuration.minted[0]);
    expect(sent.get('nonce')).toBe(configuration.minted[1]);

    // ⚠️ TWO `Set-Cookie` HEADERS, 🚫 not one carrying two cookies — which is not
    // two cookies at all.
    expect(set).toHaveLength(2);
    expect(set[0]).toContain(`__Host-age_signin_state=${configuration.minted[0]}`);
    expect(set[1]).toContain(`__Host-age_signin_nonce=${configuration.minted[1]}`);
  });

  it('🚫 sets no session cookie — this route admits nobody', () => {
    // 🛑 The session is minted at the END of the callback and only for an account
    // a human provisioned. A session here would be AGE admitting a stranger who
    // merely clicked a button.
    return POST().then((response) => {
      for (const cookie of cookies(response)) {
        expect(cookie.startsWith('__Host-age_session=')).toBe(false);
      }
    });
  });

  it('asks Google for the narrowest thing that answers the question', async () => {
    const location = (await POST()).headers.get('Location') ?? '';
    const sent = new URLSearchParams(location.slice(location.indexOf('?') + 1));

    // 🚫 `openid email` and NOTHING ELSE. AGE has no use for a profile, a photo
    // or a calendar, and a scope granted is a scope somebody later reads.
    expect(sent.get('scope')).toBe('openid email');
    expect(sent.get('response_type')).toBe('code');
    // 🚫 No refresh token: AGE never acts as this person against Google later.
    expect(sent.get('access_type')).toBe('online');
  });
});
