export type HealthFetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

/**
 * Proves an origin is this run's Scenario Lab second server: the loopback port
 * the Lab serves cross-origin frames from, picked at startup and not announced.
 * Proof is an authenticated `/__control/health` answer identical to the primary
 * server's; only the Lab holds the run token, and both servers share one state
 * store, so no other process can answer the same.
 */
export function scenarioLabOriginProof(primaryOrigin: string, runToken: string, fetchHealth: HealthFetch = fetch, timeoutMs = 2_000): (origin: string) => Promise<boolean> {
  const primary = new URL(primaryOrigin).origin;
  let expected: Promise<string | undefined> | undefined;
  const health = async (origin: string): Promise<string | undefined> => {
    try {
      const response = await fetchHealth(`${origin}/__control/health`, { headers: { authorization: `Bearer ${runToken}` }, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return undefined;
      const body = await response.json();
      return typeof body === "object" && body !== null && (body as { status?: unknown }).status === "ready" ? JSON.stringify(body) : undefined;
    } catch {
      return undefined;
    }
  };
  return async (candidate) => {
    let origin: URL;
    try { origin = new URL(candidate); } catch { return false; }
    if (origin.protocol !== "http:" || !LOOPBACK_HOSTS.has(origin.hostname) || origin.origin === primary) return false;
    const reference = await (expected ??= health(primary));
    if (reference === undefined) { expected = undefined; return false; }
    return await health(origin.origin) === reference;
  };
}
