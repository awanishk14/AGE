import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AGE — Adaptive Growth Engine',
  description: 'Adaptive Growth Intelligence Platform by Digital Dadi.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
