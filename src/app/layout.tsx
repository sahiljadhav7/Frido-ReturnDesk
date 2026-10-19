import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-outfit' });

export const metadata: Metadata = { title: 'ReturnDesk' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="font-sans antialiased">
        <header className="bg-ink-blue">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-white">ReturnDesk</Link>
            <Link href="/requests/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-medium text-ink sm:min-h-0 sm:py-2">
              Raise request
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
