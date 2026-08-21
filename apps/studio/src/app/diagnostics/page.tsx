import { presentSystemStatus } from '@age/studio-shell';

import { StateChip } from '@/components/state-chip';
import { SystemStatusPanel } from '@/components/system-status-panel';
import { boundHost, boundPort, readBusinessesView } from '@/server/operator-environment';

import { requireAgencyRendering } from '@/server/request-scope';

export const dynamic = 'force-dynamic';

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

  const view = readBusinessesView(session.organizationId);

  const facets = presentSystemStatus({
    bindHost: boundHost(),
    bindPort: boundPort(),
    recordFile: RECORD_FILE_STATUS[view.kind],
    // ⚠️ Identity is `session-verified` since ADR-0074 §7 slice 2 — the guard
    // above admitted a real session row, and Diagnostics exists to answer *"is
    // the console telling the truth about itself?"*. 🛑 Admission, 🚫 never
    // authorization; the facet's own detail says so.
    identity: 'session-verified',
    // ⚠️ A constant, and that is the point. It is not "pending", not "loading"
    // and not `false` — nothing has read the capture store (ADR-0058 D6).
    captureStore: 'not-read',
  });

  return (
    <main className="max-w-3xl p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Diagnostics</h1>
        <StateChip state="known" />
      </div>

      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        Is the console telling the truth about itself?
      </p>

      <div className="mt-6">
        <SystemStatusPanel facets={facets} />
      </div>
    </main>
  );
}
