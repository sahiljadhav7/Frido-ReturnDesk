'use client';

import { ErrorBanner } from './error-banner';
import { Shell } from './shell';

/** A page segment's error state: what failed, and a Retry that re-renders it. */
export function LoadError({ title, retry }: { title: string; retry: () => void }) {
  return (
    <Shell className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      <ErrorBanner message="Something went wrong on our side. Try again in a moment." />
      <button
        type="button"
        onClick={() => retry()}
        className="inline-flex h-12 items-center rounded-full border border-hair bg-white px-6 font-medium transition-transform duration-200 ease-press active:scale-[0.98]"
      >
        Retry
      </button>
    </Shell>
  );
}
