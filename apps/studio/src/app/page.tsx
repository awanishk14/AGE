import { presentDashboard, presentSystemStatus } from '@age/studio-shell';

import { DashboardScreen } from '@/components/dashboard-screen';
import { boundHost, boundPort, readBusinessesView } from '@/server/operator-environment';

import { requireAgencyRendering } from '@/server/request-scope';

export const dynamic = 'force-dynamic';

/**
 * ⚠️ The ONLY read this route performs is the client record file — the same
 * read the Businesses screen and Diagnostics already do, through the same one
 * effect module.
 *
 * 🚫 It does NOT produce a BIF, assemble evidence or touch the discovery
 * workspace. Those are button-pressed acts on their own screens, and doing any
 * of them here would make OPENING THE FRONT PAGE the act — a system-initiated
 * recompute, class 3 under ADR-0057 D4 even though its effect is internal.
 */
const RECORD_FILE_STATUS = {
  'not-configured': 'not-configured',
  refused: 'refused',
  none: 'read',
  listed: 'read',
} as const;

export default async function Page() {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  const session = await requireAgencyRendering();

  const businesses = readBusinessesView(session.organizationId);

  return (
    <DashboardScreen
      view={presentDashboard(businesses)}
      facets={presentSystemStatus({
        bindHost: boundHost(),
        bindPort: boundPort(),
        recordFile: RECORD_FILE_STATUS[businesses.kind],
        // ⚠️ DERIVED, 🚫 not asserted: reaching this line means a session row
        // was really read and admitted, and `session` is that row. It used to
        // read `not-established`, which stopped being true the moment this
        // route grew a boundary — 🚫 a screen claiming a blocker the
        // architecture has removed is as dishonest as one claiming a capability
        // that does not exist. 🛑 It still says nothing about entitlement.
        //
        // ⚠️ It is written as a literal because the guard above has ALREADY
        // decided it: `requireAgencyRendering()` does not return for an
        // unadmitted caller, so there is no second outcome to branch on here.
        // 🚫 Do not manufacture a ternary over `session` to make it look
        // computed — a fake derivation is harder to audit than a plain fact.
        identity: 'session-verified',
        // ⚠️ STILL a constant, and still the point: nothing has read the
        // capture store (ADR-0058 D6). 🚫 Not "pending", not `false`.
        captureStore: 'not-read',
      })}
    />
  );
}
