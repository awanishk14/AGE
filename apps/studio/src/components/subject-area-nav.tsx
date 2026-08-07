import Link from 'next/link';

import { areaHref, areasForLevel } from '@age/studio-shell';

/**
 * The way out of a subject screen.
 *
 * 🛑 THIS EXISTS BECAUSE THE OPERATOR GOT STRANDED. Every subject screen was
 * reachable only from `/businesses`, so finishing Discovery left no way forward
 * to BIF except navigating back out and in again. Worse, the placeholder
 * `SubjectAreaScreen` carried this nav while the five WIRED screens did not —
 * so the areas that actually did something were the hardest to leave.
 *
 * ⚠️ ONE IMPLEMENTATION. `SubjectAreaScreen` renders this too rather than
 * keeping its own copy — a second nav is a second truth about which areas
 * exist, and the copy that drifts still passes its own tests.
 *
 * ⚠️ The areas come from `@age/studio-shell`, never a list written here.
 *
 * 🚫 This states no order and implies no workflow. The areas are not steps and
 * there is no "next" — an operator may open any of them at any time, and
 * numbering them would assert a sequence AGE does not enforce. `wiring` is
 * shown on each item so a link never promises a screen that has no source.
 */
export function SubjectAreaNav({
  clientId,
  currentAreaId,
}: {
  readonly clientId: string;
  readonly currentAreaId?: string;
}) {
  const others = areasForLevel('subject').filter((area) => area.id !== currentAreaId);

  return (
    <nav aria-label="Other areas for this business" className="mt-8">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
        Other areas for this business
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
        {others.map((area) => (
          <li key={area.id}>
            <Link
              href={{ pathname: areaHref(area, clientId) }}
              className="text-xs text-[hsl(var(--age-text-muted))] underline underline-offset-2 hover:text-[hsl(var(--age-text))]"
            >
              {area.label}
            </Link>
            {area.wiring !== 'wired' ? (
              <span
                className="ml-1 text-[0.625rem] text-[hsl(var(--age-text-muted))]"
                title={area.notWiredBecause}
              >
                (not wired)
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
