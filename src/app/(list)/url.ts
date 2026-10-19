/** The list page's URL with some params changed. Any change but the page itself returns to page 1. */
export function withParams(current: string | URLSearchParams, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams(current);
  if (!('page' in changes)) params.delete('page');
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}
