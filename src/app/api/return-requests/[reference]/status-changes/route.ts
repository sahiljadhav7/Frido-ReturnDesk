import { changeStatus } from '@/db/writes';
import { statusChangeSchema } from '@/domain/schemas';
import { readJson, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route<RouteContext<'/api/return-requests/[reference]/status-changes'>>({
  POST: async (req, ctx) => {
    const { reference } = await ctx.params;
    // Parse before loading, so a malformed body is a 400 whatever the reference.
    const input = statusChangeSchema.parse(await readJson(req));
    return Response.json({ data: await changeStatus(reference, input) }, { status: 201 });
  },
});
