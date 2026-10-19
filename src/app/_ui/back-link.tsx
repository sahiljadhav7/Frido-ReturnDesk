import Link from 'next/link';
import { Icon } from './icons';

export function BackLink() {
  return (
    <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-full border border-hair bg-white pr-5 pl-4 text-sm">
      <Icon name="back" />
      Return requests
    </Link>
  );
}
