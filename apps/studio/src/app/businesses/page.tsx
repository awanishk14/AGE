import { BusinessesScreen } from '@/components/businesses-screen';
import { readBusinessesView } from '@/server/operator-environment';

/**
 * ⚠️ Rendered per request, never cached or statically prerendered. A cached
 * registry would keep serving a record file the operator has since corrected,
 * and "the screen disagrees with the file" is the failure this console exists
 * to make impossible.
 */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <BusinessesScreen view={readBusinessesView()} />;
}
