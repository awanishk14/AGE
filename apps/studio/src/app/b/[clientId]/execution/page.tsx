import { SubjectAreaScreen } from '@/components/subject-area-screen';

import { requireVerifiedSession } from '@/server/session-boundary';

export default async function Page({ params }: { readonly params: Promise<{ clientId: string }> }) {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  await requireVerifiedSession();

  const { clientId } = await params;
  return <SubjectAreaScreen area="execution" clientId={clientId} />;
}
