import { getReturnRequest } from '@/db/reads';
import { raise } from '@/db/writes';
import { raiseSchema } from '@/domain/schemas';
import { readJson, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = route({
  POST: async (req) => {
    const { reference } = await raise(raiseSchema.parse(await readJson(req)));
    // Same shape as GET, so the created resource never exposes internal ids.
    return Response.json({ data: await getReturnRequest(reference) }, { status: 201 });
  },
});
