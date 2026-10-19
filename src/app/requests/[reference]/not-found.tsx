import Link from 'next/link';
import { Shell } from '../../_ui/shell';

export default function NotFound() {
  return (
    <Shell className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">No return request with that reference.</h1>
      <p className="mt-2 text-muted">It may have been removed, or the link has a typo.</p>
      <Link href="/" className="mt-4 inline-block text-link underline-offset-4 hover:underline">Back to return requests</Link>
    </Shell>
  );
}
