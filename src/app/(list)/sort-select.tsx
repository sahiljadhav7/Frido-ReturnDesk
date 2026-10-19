'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '../_ui/icons';
import { withParams } from './url';

const options = [
  ['lastActivityAt:desc', 'Last activity, newest'],
  ['lastActivityAt:asc', 'Last activity, oldest'],
  ['createdAt:desc', 'Created, newest'],
  ['createdAt:asc', 'Created, oldest'],
] as const;

export function SortSelect({ value, current }: { value: string; current: string }) {
  const router = useRouter();

  function change(next: string) {
    const [sort, order] = next.split(':');
    router.push(withParams(current, { sort, order }));
  }

  return (
    <div className="relative">
      <label htmlFor="sort" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">Sort</label>
      <select
        id="sort"
        value={value}
        onChange={(e) => change(e.target.value)}
        className="h-[52px] w-full appearance-none rounded-input border border-hair bg-white pr-11 pl-16 text-soft md:min-w-64"
      >
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <Icon name="sort" className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2" />
    </div>
  );
}
