// The one way client components send a change and read a refusal; pair the message with <ErrorBanner>.
export const unreachable = "Couldn't reach the server. Try again.";

/** Reads the error envelope's message, falling back when the body isn't one. */
export async function refusalMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return (body?.error?.message as string | undefined) ?? 'Something went wrong. Try again.';
}

/** Sends a JSON change to the API. Resolves to null on success, or the server's message to show as written. */
export async function send(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return res.ok ? null : await refusalMessage(res);
  } catch {
    return unreachable;
  }
}
