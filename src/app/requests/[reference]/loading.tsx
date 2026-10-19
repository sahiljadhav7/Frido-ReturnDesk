import { Shell } from '../../_ui/shell';

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading return request…</span>
      <div className="h-11 w-44 rounded-full bg-field" />
      <div className="mt-6 h-11 w-64 max-w-full rounded-full bg-field" />
      <div className="mt-3 h-5 w-80 max-w-full rounded-full bg-field" />
      <div className="mt-6 space-y-5 md:max-w-[calc(100%-380px-2rem)]">
        {[0, 1].map((i) => (
          <Shell key={i}>
            <div className="h-6 w-24 rounded-full bg-field" />
            <div className="mt-4 h-20 rounded-inset bg-field" />
          </Shell>
        ))}
      </div>
    </div>
  );
}
