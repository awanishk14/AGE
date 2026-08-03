import { SubjectAreaScreen } from '@/components/subject-area-screen';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <SubjectAreaScreen area="peer-products" clientId={clientId} />;
}
