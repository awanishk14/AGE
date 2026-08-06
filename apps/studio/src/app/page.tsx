import { presentDashboard, presentSystemStatus } from '@age/studio-shell';

import { DashboardScreen } from '@/components/dashboard-screen';
import { boundHost, boundPort, readBusinessesView } from '@/server/operator-environment';

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

export default function Page() {
  const businesses = readBusinessesView();

  return (
    <DashboardScreen
      view={presentDashboard(businesses)}
      facets={presentSystemStatus({
        bindHost: boundHost(),
        bindPort: boundPort(),
        recordFile: RECORD_FILE_STATUS[businesses.kind],
        // ⚠️ Constants, and that is the point: there is no identity system and
        // nothing has read the capture store (ADR-0058 D2, D6). 🚫 Neither is
        // "pending" and neither is `false`.
        identity: 'not-established',
        captureStore: 'not-read',
      })}
    />
  );
}
