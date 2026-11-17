import type { Worker } from "@playwright/test";

/** The extension's own storage key for its settings (`apps/extension/src/shared/constants.ts`). */
const SETTINGS_KEY = "fluxiq.settings";

/** The addresses the extension must use from its first load: the run's isolated Core, never the product defaults. */
export type ExtensionAddresses = { gatewayUrl: string; coreApiUrl: string };

/** The part of a service worker this needs, so a test drives it without a browser. */
export type SettingsWorker = Pick<Worker, "evaluate"> & { url?(): string };

type WorkerChrome = { storage?: { local?: { set(items: Record<string, unknown>): Promise<void>; get(key: string): Promise<Record<string, { coreApiUrl?: string } | undefined>> } } };

/**
 * Writes the extension's settings through its service worker. The worker builds its connection
 * from stored settings once and keeps it in memory, so storage alone is too late for a worker that
 * already started: the caller must stop that worker (`preconfigureExtensionWhenReady`) so its
 * successor builds from them. That is what makes the panel's very first reachability probe go to the isolated Core and not to the
 * default web address (which the strict network guard rightly blocks). The settings carry every
 * field the extension saves, so the stored value needs no repair on first read.
 */
export async function preconfigureExtension(worker: SettingsWorker, addresses: ExtensionAddresses): Promise<void> {
  const settings = { gatewayUrl: addresses.gatewayUrl, coreApiUrl: addresses.coreApiUrl, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true, requestsEnabled: false };
  const stored = await worker.evaluate(async ({ key, value }) => {
    const chrome = (globalThis as unknown as { chrome?: WorkerChrome }).chrome;
    if (!chrome?.storage?.local) return `no extension APIs in the worker (chrome ${typeof chrome})`;
    await chrome.storage.local.set({ [key]: value });
    const read = (await chrome.storage.local.get(key))[key];
    if (read?.coreApiUrl !== (value as { coreApiUrl: string }).coreApiUrl) return "the stored settings did not read back";
    return "ok";
  }, { key: SETTINGS_KEY, value: settings });
  if (stored !== "ok") throw new Error(`The extension's settings were not stored before the panel opened: ${String(stored)}`);
}

/**
 * `preconfigureExtension` against whichever extension worker is alive, tried again for up to
 * `waitMs` (a worker may be stopped or restarting as the browser starts), then `stop` ends that
 * worker and `wake` asks for a new one, which builds its connection from the stored settings (a
 * MV3 worker starts only when something needs it). The last failure is the one reported.
 */
export async function preconfigureExtensionWhenReady(currentWorker: () => SettingsWorker | undefined, addresses: ExtensionAddresses, options: { waitMs?: number; stop: () => Promise<void>; wake: () => Promise<void> }): Promise<void> {
  const deadline = Date.now() + (options.waitMs ?? 20_000);
  let attempts = 0;
  let failure: unknown = new Error("No extension service worker was running");
  for (;;) {
    const worker = currentWorker();
    if (worker) {
      try {
        await preconfigureExtension(worker, addresses);
        break;
      } catch (error) {
        attempts += 1;
        failure = new Error(`${error instanceof Error ? error.message : String(error)} (attempt ${attempts})`);
      }
    }
    if (Date.now() >= deadline) throw failure;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await options.stop();
  await options.wake();
}
