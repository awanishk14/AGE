import Link from 'next/link';

import { CreateClientForm } from '@/components/create-client-form';
import { createClientAction } from '@/server/client-actions';

/**
 * ⚠️ Rendered per request. The form writes to the operator's record file, and a
 * statically prerendered page would be served from a build that never saw it.
 */
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <main className="max-w-3xl p-8">
      <p className="text-xs text-[hsl(var(--age-text-muted))]">
        <Link href={{ pathname: '/businesses' }} className="underline underline-offset-2">
          Businesses
        </Link>
        {' / '}
        <span className="font-medium text-[hsl(var(--age-text))]">New</span>
      </p>

      <h1 className="mt-3 text-lg font-semibold tracking-tight">Create a client</h1>
      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
        A client record is how AGE names one real business and nothing more — which scope it belongs
        to, and what it is called in the other tools you use.
      </p>

      <CreateClientForm create={createClientAction} />
    </main>
  );
}
