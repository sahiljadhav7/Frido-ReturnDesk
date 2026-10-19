import { addNote } from '@/db/writes';
import { noteSchema } from '@/domain/schemas';
import { readJson, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Notes are append-only: POST is the only method, the rest answer a JSON 405.
export const { GET, POST, PUT, PATCH, DELETE } = route<RouteContext<'/api/return-requests/[reference]/notes'>>({
  POST: async (req, ctx) => {
    const { reference } = await ctx.params;
    const { body } = noteSchema.parse(await readJson(req));
    return Response.json({ data: await addNote(reference, body) }, { status: 201 });
  },
});
