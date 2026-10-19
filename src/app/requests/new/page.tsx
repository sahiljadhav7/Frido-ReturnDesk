import { orderNumberRange } from '@/db/reads';
import { RaiseForm } from './raise-form';

export const dynamic = 'force-dynamic';

export default async function RaiseRequestPage() {
  // Only a hint: if it can't be read, the page still raises requests without it.
  const range = await orderNumberRange().catch((e) => {
    console.error(e);
    return null;
  });
  return <RaiseForm orderRange={range} />;
}
