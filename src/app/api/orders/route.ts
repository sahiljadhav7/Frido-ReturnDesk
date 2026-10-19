import { searchOrders } from '@/db/reads';
import { orderSearchSchema } from '@/domain/schemas';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route({
  GET: async (req) => {
    const { q } = orderSearchSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return Response.json({ data: await searchOrders(q) });
  },
});
