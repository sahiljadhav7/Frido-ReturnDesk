import { getOrderByNumber } from '@/db/reads';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route<RouteContext<'/api/orders/[number]'>>({
  GET: async (_req, ctx) => {
    const { number } = await ctx.params;
    return Response.json({ data: await getOrderByNumber(number) });
  },
});
