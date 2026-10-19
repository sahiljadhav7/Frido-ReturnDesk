'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`hidden rounded-full px-4 py-2 text-sm sm:inline-flex ${current ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white'}`}
    >
      {children}
    </Link>
  );
}
