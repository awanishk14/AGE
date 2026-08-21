import { ClientRenderingScreen } from '@/components/client-rendering-screen';
import { resolveBusinessScope } from '@/server/operator-environment';
import { requireClientRendering } from '@/server/request-scope';

export const dynamic = 'force-dynamic';

/**
 * **THE CLIENT RENDERING** — ADR-0087, and the third of the owner's three tiers.
 *
 * 🛑 **NO ROUTE PARAMETER, AND THAT IS THE DECISION.** Every other subject route
 * is `b/[clientId]`, where the id is a FILTER applied inside an entitlement. A
 * client viewer has exactly one subject, so a segment here would be a slot in
 * which to name somebody else's business. 🚫 Do not add one.
 *
 * ⚠️ **THE `clientId` COMES FROM THE MEMBERSHIP, RE-READ THIS REQUEST** — 🚫 not
 * from the URL, 🚫 not from the cookie, and 🚫 not from a claim on the session
 * row. There is deliberately no scope column on `operator_sessions`: a flag on a
 * session is precisely how a bypass arrives.
 *
 * ⚠️ **REACHABLE SINCE ADR-0088, AND STILL 🚫 NOT BROWSER-PROVEN.** `decideSignIn`
 * now admits a client membership, and `requireAgencyRendering` sends one here
 * from `/`. But a client account and its membership are **owner acts** — AGE
 * mints nothing — so no client has ever loaded this page. 🚫 Do not report it as
 * verified until one has.
 */
export default async function Page() {
  // 🛑 THE GATE, BEFORE ANY PROTECTED READ. It does not return for a caller
  // whose scope is not a client's — 🚫 there is no falsy value to forget.
  const request = await requireClientRendering();

  return (
    <ClientRenderingScreen scope={resolveBusinessScope(request.organizationId, request.clientId)} />
  );
}
