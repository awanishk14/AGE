import { SourcesScreen } from '@/components/sources-screen';

import { requireAgencyRendering } from '@/server/request-scope';

// 🚫 Never cached. The client record is the operator's own file and can change
// between visits; a cached page would disagree with it. 🚫 And nothing is read
// on open — the document is read only when the operator presses.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  const session = await requireAgencyRendering();

  const { clientId } = await params;
  return <SourcesScreen entitledOrganizationId={session.organizationId} clientId={clientId} />;
}
