import { presentSystemStatus } from '@age/studio-shell';

import { StateChip } from '@/components/state-chip';
import { SystemStatusPanel } from '@/components/system-status-panel';
import { boundHost, boundPort, readBusinessesView } from '@/server/operator-environment';

export const dynamic = 'force-dynamic';

const RECORD_FILE_STATUS = {
  'not-configured': 'not-configured',
  refused: 'refused',
  none: 'read',
  listed: 'read',
} as const;

export default function Page() {
  const view = readBusinessesView();

  const facets = presentSystemStatus({
    bindHost: boundHost(),
    bindPort: boundPort(),
    recordFile: RECORD_FILE_STATUS[view.kind],
    // ⚠️ Both of these are constants, and that is the point. They are not
    // "pending", not "loading" and not `false` — there is no identity system
    // and nothing has read the capture store (ADR-0058 D2, D6).
    identity: 'not-established',
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
