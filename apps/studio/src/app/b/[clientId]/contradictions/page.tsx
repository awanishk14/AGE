import { ContradictionsScreen } from '@/components/contradictions-screen';

import { requireVerifiedSession } from '@/server/session-boundary';

// 🚫 Never cached. The client record and the answer file are the operator's own
// files and can change between visits; a cached page would disagree with them.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  const session = await requireVerifiedSession();

  const { clientId } = await params;
  return (
    <ContradictionsScreen entitledOrganizationId={session.organizationId} clientId={clientId} />
  );
}
