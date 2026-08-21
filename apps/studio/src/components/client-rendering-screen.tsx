import type { BusinessScope } from '@/server/operator-environment';

/**
 * **WHAT A CLIENT SEES OF THEMSELVES** — ADR-0087.
 *
 * 🛑 **READ-ONLY, AND 🚫 NOT BECAUSE THE FORMS WERE LEFT OUT.** A client viewer
 * holds `snapshot.read` and `rendering.client` and nothing else, so every write
 * action in this console refuses their scope at the capability check — before
 * any subject is compared. ⚠️ This screen omitting a button is a CONSEQUENCE of
 * that, 🚫 never the mechanism: a form pasted back in by hand would still be
 * refused by the action it posts to.
 *
 * 🚫 **NOTHING HERE NAMES ANOTHER CLIENT**, counts siblings, or hints that an
 * agency has others. Absence and denial must be indistinguishable, or a client
 * learns the shape of an agency's book by watching which pages differ.
 */
export function ClientRenderingScreen({ scope }: { readonly scope: BusinessScope }) {
  if (scope.kind !== 'resolved') {
    /*
      🛑 **THE SAME PAGE FOR "NOT CONFIGURED" AND "NOT FOUND", ON PURPOSE.** A
      client cannot act on either, and distinguishing them tells an outside
      caller whether an id they hold is real. ⚠️ It says whose problem it is,
      because a person shown nothing assumes their access was revoked.
    */
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-lg font-semibold tracking-tight">Your business</h1>
        <section
          role="status"
          className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4 text-sm"
        >
          <h2 className="font-semibold">AGE has no record to show you yet</h2>
          <p className="mt-2 text-[hsl(var(--age-text-muted))]">
            This is something your agency sets up. Nothing is wrong with your account, and there is
            nothing for you to fix here.
          </p>
        </section>
      </main>
    );
  }

  const client = scope.client;
  const externalRefs = Object.entries(client.externalRefs);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-lg font-semibold tracking-tight">{client.displayName}</h1>
      <p className="mt-1 font-mono text-xs text-[hsl(var(--age-text-muted))]">{client.clientId}</p>

      <section className="mt-6 rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Where AGE knows you elsewhere</h2>
        {externalRefs.length === 0 ? (
          /*
            ⚠️ **AN UNMAPPED BUSINESS, 🚫 NOT "0 SYSTEMS".** A measured zero and
            an absence read the same on a screen and mean different things.
          */
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
            No external systems are mapped for this business.
          </p>
        ) : (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {externalRefs.map(([system, reference]) => (
              <div key={system} className="contents">
                <dt className="font-medium">{system}</dt>
                <dd className="font-mono text-xs">{reference}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="mt-4 rounded border border-[hsl(var(--age-unknown))] p-4">
        <h2 className="text-sm font-semibold">Assessment</h2>
        {/*
          🛑 **`not-assessed` WITH ITS REASON — 🚫 never a zero, 🚫 never
          "none"** (constitution §2, ADR-0087 §4). Nothing has read the capture
          store, so this is an UNLOOKED-AT absence, and rendering it as "no
          findings" would convert an unknown into good news.
        */}
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          Not assessed. No assessment has been filed for this business, which is different from one
          that was made and found nothing.
        </p>
      </section>

      <form method="post" action="/sign-out" className="mt-8">
        <button type="submit" className="text-sm text-[hsl(var(--age-text-muted))] underline">
          Sign out
        </button>
      </form>
    </main>
  );
}
