import { EvidenceScreen } from '@/components/evidence-screen';

// 🚫 Never cached. The client record and the answer file are the operator's own
// files and can change between visits; a cached page would disagree with them.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <EvidenceScreen clientId={clientId} />;
}
