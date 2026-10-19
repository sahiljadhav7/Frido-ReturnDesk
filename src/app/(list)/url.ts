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

/**
 * The searches the box has put in the URL that haven't landed yet. Searches use replace, so the
 * back button or a link always brings a value the box didn't just send: that one it follows.
 */
export function pendingSearches() {
  let queue: string[] = [];
  return {
    send(q: string) {
      queue.push(q);
    },
    /** True when `q` came from outside and the box should show it. */
    follow(q: string) {
      const i = queue.lastIndexOf(q);
      // Navigations land in order, so this one and any before it are done.
      queue = i >= 0 ? queue.slice(i + 1) : [];
      return i < 0;
    },
  };
}
