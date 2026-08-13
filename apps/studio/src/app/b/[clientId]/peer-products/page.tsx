import { PeerProductsScreen } from '@/components/peer-products-screen';

// 🚫 Never cached. The client record is the operator's own file and can change
// between visits; a cached page would disagree with it. 🚫 And nothing is read
// on open — the store is read only when the operator presses.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <PeerProductsScreen clientId={clientId} />;
}
