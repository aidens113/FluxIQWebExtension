// The gateway token Core issued the paired extension, read from the
// extension's own session record (`fluxiq.session` in `chrome.storage.local`,
// `apps/extension/src/background/storage.ts`) through its service worker. It
// is held in this process only, as a value the trace secret search looks for
// (`trace-inspection/holds-any-secret.ts`); it is never written, printed or
// returned in a receipt.

import type { BrowserContext } from "@playwright/test";

/**
 * The extension's current gateway token, or null when no extension worker is
 * running or its session record holds no token. A worker that cannot be asked
 * throws; the caller counts that as a failed read.
 */
export async function readExtensionSessionToken(context: Pick<BrowserContext, "serviceWorkers">): Promise<string | null> {
  for (const worker of context.serviceWorkers().filter(candidate => candidate.url().startsWith("chrome-extension://"))) {
    const token = await worker.evaluate(async () => {
      const chromeApi = (globalThis as { chrome?: { storage?: { local?: { get(key: string): Promise<Record<string, unknown>> } } } }).chrome;
      const local = chromeApi?.storage?.local;
      if (!local) return null;
      const record = (await local.get("fluxiq.session"))["fluxiq.session"];
      const value = typeof record === "object" && record !== null ? (record as { token?: unknown }).token : undefined;
      return typeof value === "string" && value.length > 0 ? value : null;
    });
    if (token !== null) return token;
  }
  return null;
}
