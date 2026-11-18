/** Per-connection ownership; expected cancellation is counted, other failures refuse acceptance. */
export function createProxyTransport(): { observe(error: unknown): void; counts(): { connectionResets: number; transportFailures: number } } {
  const seen = new WeakSet<object>();
  let connectionResets = 0;
  let transportFailures = 0;
  return {
    observe(error) {
      if (error && typeof error === "object") {
        if (seen.has(error)) return;
        seen.add(error);
      }
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "ECONNRESET" || code === "EPIPE") connectionResets += 1;
      else transportFailures += 1;
    },
    counts: () => ({ connectionResets, transportFailures })
  };
}
