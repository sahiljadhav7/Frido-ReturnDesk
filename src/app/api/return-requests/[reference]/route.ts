import { getReturnRequest } from '@/db/reads';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route<RouteContext<'/api/return-requests/[reference]'>>({
  GET: async (_req, ctx) => {
    const { reference } = await ctx.params;
    return Response.json({ data: await getReturnRequest(reference) });
  },
});
