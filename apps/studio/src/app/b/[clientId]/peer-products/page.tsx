import { PeerProductsScreen } from '@/components/peer-products-screen';

import { requireVerifiedSession } from '@/server/session-boundary';

// 🚫 Never cached. The client record is the operator's own file and can change
// between visits; a cached page would disagree with it. 🚫 And nothing is read
// on open — the store is read only when the operator presses.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  await requireVerifiedSession();

  const { clientId } = await params;
  return <PeerProductsScreen clientId={clientId} />;
}
