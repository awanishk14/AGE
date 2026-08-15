import { BusinessesScreen } from '@/components/businesses-screen';
import { readBusinessesView } from '@/server/operator-environment';

import { requireVerifiedSession } from '@/server/session-boundary';

/**
 * ⚠️ Rendered per request, never cached or statically prerendered. A cached
 * registry would keep serving a record file the operator has since corrected,
 * and "the screen disagrees with the file" is the failure this console exists
 * to make impossible.
 */
export const dynamic = 'force-dynamic';

export default async function Page() {
  // 🛑 THE BOUNDARY, BEFORE ANY PROTECTED QUERY (ADR-0074 §7 slice 2). It
  // does not return for an unadmitted caller — 🚫 there is no falsy value to
  // forget to check. A route contract test asserts this line precedes every
  // `@/server/*` call in this file.
  const session = await requireVerifiedSession();

  return <BusinessesScreen view={readBusinessesView(session.organizationId)} />;
}
