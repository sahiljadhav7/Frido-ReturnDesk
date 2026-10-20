import { type NextRequest } from 'next/server';
import { errorResponse } from '@/lib/http';

/** A path Next can't percent-decode fails before any route runs, as an HTML 500. Answer it with the JSON envelope instead. */
export function proxy(request: NextRequest) {
  try {
    decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return errorResponse(400, 'malformed_url', 'The URL has invalid percent-encoding.');
  }
}

// Only path segments can be undecodable in a way Next can't survive; query strings it already tolerates.
export const config = { matcher: ['/api/:path*', '/requests/:path*'] };
