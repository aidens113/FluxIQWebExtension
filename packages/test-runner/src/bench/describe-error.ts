/** An error's message on one line, cut to `limit` characters, for a run record's problems. */
export function describeError(error: unknown, limit = 300): string {
  const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").trim();
  return message.length > limit ? `${message.slice(0, limit - 3)}...` : message;
}
