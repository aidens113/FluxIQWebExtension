import { RunnerFailure } from "../failure.js";

type ExtensionServiceWorker = {
  url(): string;
};

type ExtensionWorkerContext = {
  serviceWorkers(): readonly ExtensionServiceWorker[];
  on(event: "serviceworker", listener: (worker: ExtensionServiceWorker) => void): unknown;
  off(event: "serviceworker", listener: (worker: ExtensionServiceWorker) => void): unknown;
  browser(): { isConnected(): boolean } | null;
};

type Timer = ReturnType<typeof setTimeout>;
type ExtensionReadinessOptions = {
  setTimer?: (callback: () => void, delayMs: number) => Timer;
  clearTimer?: (timer: Timer) => void;
};

const EXTENSION_WORKER_TIMEOUT_MS = 30_000;

/** Waits for a real extension worker and retains only closed lifecycle diagnostics on timeout. */
export async function awaitExtensionWorker(
  context: ExtensionWorkerContext,
  options: ExtensionReadinessOptions = {},
): Promise<ExtensionServiceWorker> {
  const timeoutMs = EXTENSION_WORKER_TIMEOUT_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const observed = new Set<ExtensionServiceWorker>();

  const existing = observeWorkers(context.serviceWorkers(), observed);
  if (existing) return existing;

  return new Promise<ExtensionServiceWorker>((resolve, reject) => {
    let timer: Timer | undefined;
    let settled = false;
    const cleanup = () => {
      context.off("serviceworker", onWorker);
      if (timer !== undefined) clearTimer(timer);
    };
    const finish = (worker: ExtensionServiceWorker) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(worker);
    };
    const onWorker = (worker: ExtensionServiceWorker) => {
      observed.add(worker);
      if (isExtensionWorker(worker)) finish(worker);
    };

    context.on("serviceworker", onWorker);
    if (settled) return;
    // Close the gap between observation zero and listener registration.
    const registeredWhileSubscribing = observeWorkers(context.serviceWorkers(), observed);
    if (registeredWhileSubscribing) {
      finish(registeredWhileSubscribing);
      return;
    }
    if (settled) return;
    timer = setTimer(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new RunnerFailure("extension.worker", "Timed out waiting for the Chrome extension service worker", {
        details: {
          timeoutMs,
          observedWorkerCount: observed.size,
          browserConnected: context.browser()?.isConnected() ?? false,
        },
      }));
    }, timeoutMs);
  });
}

function observeWorkers(
  workers: readonly ExtensionServiceWorker[],
  observed: Set<ExtensionServiceWorker>,
): ExtensionServiceWorker | undefined {
  for (const worker of workers) {
    observed.add(worker);
    if (isExtensionWorker(worker)) return worker;
  }
  return undefined;
}

function isExtensionWorker(worker: ExtensionServiceWorker): boolean {
  try {
    return new URL(worker.url()).protocol === "chrome-extension:";
  } catch {
    return false;
  }
}
