import { areaByRoute } from '@age/studio-shell';

import { StateChip } from './state-chip';

interface AreaScreenProps {
  readonly route: string;
}

/**
 * Every Studio screen, until it is wired to something real.
 *
 * ⚠️ This is the honest empty state, and it is deliberately NOT a skeleton, a
 * spinner or a shimmering placeholder: those imply data is arriving. Nothing is
 * arriving. The screen states the question the area will answer, that AGE has
 * not assessed it, and what has to happen first.
 *
 * 🚫 It renders no number, no score, no count and no example row. A screen that
 * invents a value for a real business is AGE lying about that business
 * (`18_AGE_STUDIO.md` §7.1).
 */
export function AreaScreen({ route }: AreaScreenProps) {
  const area = areaByRoute(route);

  if (!area) {
    // 🚫 No fallback area, no redirect to a plausible one. An unknown route is
    // an unknown route.
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold">Unknown screen</h1>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          {route} is not an AGE Studio area.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl p-8">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{area.label}</h1>
        <StateChip state="not-assessed" />
      </div>

      <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{area.question}</p>

      {area.wiring === 'not-wired' ? (
        <section className="mt-6 rounded border border-dotted border-[hsl(var(--age-not-assessed))] p-4">
          <h2 className="text-sm font-semibold">This screen is not wired yet</h2>
          <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">{area.notWiredBecause}</p>
          <p className="mt-3 text-xs text-[hsl(var(--age-text-muted))]">
            Nothing is shown here because nothing has been read — not because AGE looked and found
            nothing. Those are different states, and this one is the first.
          </p>
        </section>
      ) : null}
    </main>
  );
}
