import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/sidebar';

import './globals.css';

export const metadata: Metadata = {
  title: 'AGE Studio',
  description: 'Local operator console for AGE. No business execution.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            {/*
              ⚠️ The banner is not decoration. An operator must be able to tell,
              from any screen, what this surface may and may not do, and that no
              business has been selected. 🚫 Do not hide it once screens have
              content.

              🚫 It must NOT say "read-only". ADR-0057 §0.7 retired that term:
              Platform Administration and Knowledge Authoring are allowed, and it
              is Business Execution — anything reaching an external system, and
              anything AGE initiates itself — that is refused. Saying "read-only"
              here would be the kind of confident falsehood this product exists
              to refuse.
            */}
            {/*
              ⚠️ CORRECTED 2026-08-07. It used to end "nothing here is wired to
              real data yet". That stopped being true eight slices ago — the
              console reads the operator's own client record and their own
              answer files — and a banner that understates what a surface does
              is the same failure as one that overstates it. An operator who
              read it while looking at their own business's answers would have
              to decide which of the two the console was lying about.
            */}
            <header className="border-b border-[hsl(var(--age-border))] px-8 py-3 text-xs text-[hsl(var(--age-text-muted))]">
              No business execution · runs on your machine, against files you named · nothing is
              sent anywhere
            </header>
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
