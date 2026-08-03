import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/sidebar';

import './globals.css';

export const metadata: Metadata = {
  title: 'AGE Studio',
  description: 'Local operator console for AGE. Read-only.',
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
              from any screen, that this surface reads and never writes, and
              that no business has been selected. 🚫 Do not hide it once screens
              have content.
            */}
            <header className="border-b border-[hsl(var(--age-border))] px-8 py-3 text-xs text-[hsl(var(--age-text-muted))]">
              Read-only · no business selected · nothing here is wired to real data yet
            </header>
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
