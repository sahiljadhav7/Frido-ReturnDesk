import { getReturnRequest, listReturnRequests } from '@/db/reads';
import { raise } from '@/db/writes';
import { listQuerySchema, raiseSchema } from '@/domain/schemas';
import { readJson, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route({
  GET: async (req) => {
    const query = listQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return Response.json(await listReturnRequests(query));
  },
  POST: async (req) => {
    const { reference } = await raise(raiseSchema.parse(await readJson(req)));
    // Same shape as GET, so the created resource never exposes internal ids.
    return Response.json({ data: await getReturnRequest(reference) }, { status: 201 });
  },
});
