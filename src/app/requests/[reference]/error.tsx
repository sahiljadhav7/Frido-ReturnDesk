'use client';

import { ErrorBanner } from '../../_ui/error-banner';
import { Shell } from '../../_ui/shell';

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <Shell className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-[-0.02em]">Couldn&apos;t load this return request.</h1>
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
