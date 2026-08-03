import Link from 'next/link';

import { areasForLevel, type AreaLevel } from '@age/studio-shell';

const SECTIONS: readonly { level: AreaLevel; heading: string }[] = [
  { level: 'console', heading: 'Console' },
  { level: 'business', heading: 'Businesses' },
  { level: 'subject', heading: 'Within a business' },
];

/**
 * Studio navigation.
 *
 * ⚠️ The areas come from `@age/studio-shell`, not from a list written here. A
 * second list is a second truth. 🚫 Do not add a link that has no area.
 *
 * ⚠️ Every area currently reads "not wired", and the sidebar says so on each
 * item rather than presenting a full navigation that leads to empty screens.
 */
export function Sidebar() {
  return (
    <nav aria-label="AGE Studio" className="w-72 shrink-0 border-r border-[hsl(var(--age-border))]">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold tracking-tight">AGE Studio</p>
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          Local operator console · 127.0.0.1
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.level} className="px-2 pb-4">
          <p className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[hsl(var(--age-text-muted))]">
            {section.heading}
          </p>
          <ul>
            {areasForLevel(section.level).map((area) => (
              <li key={area.id}>
                <Link
                  href={{ pathname: area.route }}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-[hsl(var(--age-surface))]"
                >
                  <span>{area.label}</span>
                  {area.wiring === 'not-wired' ? (
                    <span
                      className="text-[0.625rem] uppercase tracking-wide text-[hsl(var(--age-not-assessed))]"
                      title={area.notWiredBecause}
                    >
                      not wired
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
