import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Link from 'next/link';
import { Icon } from './_ui/icons';
import { NavLink } from './_ui/nav-link';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-outfit' });

export const metadata: Metadata = { title: 'ReturnDesk' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen font-sans antialiased">
        <div className="mx-auto max-w-6xl px-4">
          <header className="mt-5 flex h-[58px] items-center justify-between rounded-full bg-ink-blue pr-1.5 pl-5 shadow-card sm:h-16 sm:pr-2">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold text-white">
                <span className="flex size-7 items-center justify-center rounded-lg bg-brand" aria-hidden>
                  <span className="size-2.5 rotate-45 rounded-[3px] bg-ink-blue" />
                </span>
                ReturnDesk
              </Link>
              <NavLink href="/">Requests</NavLink>
            </div>
            <Link
              href="/requests/new"
              className="inline-flex h-11 items-center gap-3 rounded-full bg-brand pr-1.5 pl-5 font-medium text-ink shadow-glow transition-transform duration-200 ease-press active:scale-[0.98] sm:h-12"
            >
              Raise request
              <span className="flex size-[30px] items-center justify-center rounded-full bg-[#e6bc00]/40 sm:size-9">
                <Icon name="plus" />
              </span>
            </Link>
          </header>
          <div className="py-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
