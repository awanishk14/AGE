import { BusinessProfileScreen } from '@/components/business-profile-screen';

// 🚫 Never cached. The draft state it reports changes as the operator works,
// and a cached page would report a saved draft that no longer exists.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <BusinessProfileScreen clientId={clientId} />;
}
