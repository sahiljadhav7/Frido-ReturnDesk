'use client';

import { LoadError } from '../_ui/load-error';

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <LoadError title="Couldn't load return requests." retry={retry} />;
}
