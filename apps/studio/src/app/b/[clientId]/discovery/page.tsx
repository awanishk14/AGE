import { DiscoveryScreen } from '@/components/discovery-screen';

// 🚫 Never cached. A cached form would show a draft the operator has since
// changed, and autosave would then write the stale one back over their work.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <DiscoveryScreen clientId={clientId} />;
}
