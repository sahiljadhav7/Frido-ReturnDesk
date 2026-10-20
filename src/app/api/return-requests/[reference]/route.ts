import { getReturnRequest } from '@/db/reads';
import { correct, remove } from '@/db/writes';
import { correctionSchema, removalSchema } from '@/domain/schemas';
import { readJson, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route<RouteContext<'/api/return-requests/[reference]'>>({
  GET: async (_req, ctx) => {
    const { reference } = await ctx.params;
    return Response.json({ data: await getReturnRequest(reference) });
  },
  PATCH: async (req, ctx) => {
    const { reference } = await ctx.params;
    // Parse before loading, so `status` or a malformed body is a 400 whatever the reference.
    const input = correctionSchema.parse(await readJson(req));
    return Response.json({ data: await correct(reference, input) });
  },
  DELETE: async (req, ctx) => {
    const { reference } = await ctx.params;
    const { expectedLastActivityAt } = removalSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    await remove(reference, expectedLastActivityAt);
    return new Response(null, { status: 204 });
  },
});
