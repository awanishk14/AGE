import { describe, expect, it, vi } from 'vitest';

/**
 * The door, given something that is not a credential — ADR-0074 §7 slice 4.
 *
 * 🛑 **THIS IS THE ONE ROUTE AN UNAUTHENTICATED CALLER ON THE PUBLIC INTERNET
 * CAN REACH.** Every other route redirects before it does anything. So the
 * question this file asks is not "does a good token work" (slice 2 answered
 * that, on the real VPS) but "what happens when the body is nonsense" — which
 * is the first thing anybody pointing a scanner at a public host will send.
 *
 * ⚠️ **MEASURED BEFORE THE FIX: A 500.** `formData()` throws on a body that is
 * not a form, and the throw was unguarded. That is a wrong answer twice over:
 * nothing failed — a caller sent nonsense — and a 500 is the response an
 * attacker works to provoke, because it is where stack traces come from.
 *
 * 🛑 **AND THE REFUSAL MUST BE THE SAME ONE.** A distinguishable answer for
 * "malformed body" versus "wrong token" tells a prober which half of their
 * guess was right. `refused=1` is the whole vocabulary.
 */

vi.mock('@/server/operator-environment', () => ({
  sessionLookupOrganizationId: () => 'org-under-test',
  // ⚠️ Never reached by any case here — every one of them is refused BEFORE a
  // credential is verified. If a case ever does reach it, the assertion below
  // that the outcome is a refusal still holds it honest.
  verifySessionToken: async () => ({ outcome: 'unverified' as const, reason: 'no-such-session' }),
}));

const { POST } = await import('./route');

const URL_UNDER_TEST = 'https://console.example/sign-in/submit';

/** Every shape of body that is not a form. 🚫 None may produce a 5xx. */
const MALFORMED: readonly { readonly label: string; readonly init: RequestInit }[] = [
  { label: 'an empty body', init: {} },
  {
    label: 'a JSON body',
    init: { body: '{"token":"x"}', headers: { 'content-type': 'application/json' } },
  },
  {
    label: 'a truncated multipart body',
    init: {
      body: '--boundary\r\nContent-Disposition: form-data; name="token"',
      headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
    },
  },
  {
    label: 'a body claiming to be a form and containing binary',
    init: {
      body: '\u0000\u0001\u0002',
      headers: { 'content-type': 'multipart/form-data; boundary=nothing-like-it' },
    },
  },
];

describe('a body that is not a form is refused, 🚫 never a 500', () => {
  it('answers every malformed body with the same refusal', async () => {
    let examined = 0;

    for (const { label, init } of MALFORMED) {
      examined += 1;

      const response = await POST(new Request(URL_UNDER_TEST, { method: 'POST', ...init }));

      expect(response.status, `${label} did not produce a redirect`).toBe(303);
      expect(response.headers.get('Location'), `${label} produced a different answer`).toBe(
        '/sign-in?refused=1',
      );

      // 🛑 A refusal SETS NO COOKIE. The failure that would matter here is a
      // session handed out on the way to saying no.
      expect(response.headers.get('Set-Cookie'), `${label} set a cookie while refusing`).toBeNull();
    }

    // ⚠️ Asserted after the loop: a `MALFORMED` list that silently emptied would
    // otherwise report compliance without examining anything.
    expect(examined).toBe(MALFORMED.length);
  });

  it('gives a well-formed form with a wrong token the SAME answer', async () => {
    // 🛑 THE POINT OF THE WHOLE FILE. If this ever differs from the cases above,
    // the shape of the request has become distinguishable from the correctness
    // of the credential in it, and a prober can tell the two apart.
    // ⚠️ THE WIRE FORM, 🚫 not a `URLSearchParams` instance. Under jsdom the
    // global `URLSearchParams` belongs to a different realm than the `Request`
    // constructor's, so the instance check fails — on the Linux runner only,
    // while this file passed locally. ⚠️ The encoded string is what a browser
    // puts on the wire regardless, so this is the more faithful input as well
    // as the portable one.
    const response = await POST(
      new Request(URL_UNDER_TEST, {
        method: 'POST',
        body: 'token=not-a-real-token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/sign-in?refused=1');
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
});
