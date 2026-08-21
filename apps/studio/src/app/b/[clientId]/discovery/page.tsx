import { DiscoveryScreen } from '@/components/discovery-screen';

import { requireAgencyRendering } from '@/server/request-scope';

// 🚫 Never cached. A cached form would show a draft the operator has since
// changed, and autosave would then write the stale one back over their work.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  const session = await requireAgencyRendering();

  const { clientId } = await params;
  return <DiscoveryScreen entitledOrganizationId={session.organizationId} clientId={clientId} />;
}
