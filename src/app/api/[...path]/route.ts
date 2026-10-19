import { AppError } from '@/domain/errors';
import { route } from '@/lib/http';

const notFound = () => {
  throw new AppError(404, 'not_found', 'No such API route.');
};

export const { GET, POST, PUT, PATCH, DELETE } = route({ GET: notFound, POST: notFound, PUT: notFound, PATCH: notFound, DELETE: notFound });
