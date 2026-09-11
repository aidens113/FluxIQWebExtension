// The `chrome.runtime` a content script sees when the harness, not an
// extension, loads it. The function is serialized into the page as an init
// script, so it must stay self-contained: no imports, and no reference to
// anything outside its own body.
//
// Outgoing: every `chrome.runtime.sendMessage` is kept, as a JSON copy taken
// when it was sent, in `window[globalName].sent`. Incoming:
// `window[globalName].deliver(message)` hands a message to every `onMessage`
// listener under Chrome's reply rules: the first `sendResponse` wins, a
// listener that returns `true` keeps the channel open for an async reply, and
// otherwise the sender learns that nobody answered. Messages cross as JSON
// both ways, as extension messaging serializes them.

/** What `deliver` resolves with: whether a listener answered, and its answer. */
export type HarnessDelivery = { responded: boolean; response?: unknown };

export function installRuntimeStub(globalName: string): void {
  type Listener = (message: unknown, sender: { id: string }, sendResponse: (response?: unknown) => void) => unknown;
  const listeners: Listener[] = [];
  const sent: unknown[] = [];
  const copy = (value: unknown): unknown => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const sender = { id: "fluxiq-content-harness" };
  const runtime = {
    id: sender.id,
    sendMessage(message: unknown): Promise<undefined> {
      sent.push(copy(message));
      return Promise.resolve(undefined);
    },
    onMessage: {
      addListener(listener: Listener): void {
        listeners.push(listener);
      },
      removeListener(listener: Listener): void {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
      hasListener(listener: Listener): boolean {
        return listeners.includes(listener);
      }
    }
  };
  const deliver = (message: unknown): Promise<HarnessDelivery> => new Promise((resolve, reject) => {
    let settled = false;
    let keepOpen = false;
    const sendResponse = (response?: unknown): void => {
      if (settled) return;
      settled = true;
      resolve({ responded: true, response: copy(response) });
    };
    try {
      for (const listener of [...listeners]) {
        if (listener(copy(message), sender, sendResponse) === true) keepOpen = true;
      }
    } catch (error) {
      settled = true;
      reject(error);
      return;
    }
    if (!keepOpen && !settled) {
      settled = true;
      resolve({ responded: false });
    }
  });
  const host = window as unknown as Record<string, unknown> & { chrome?: object };
  const chromeObject = host.chrome ?? {};
  Object.defineProperty(chromeObject, "runtime", { value: runtime, configurable: true, writable: true });
  host.chrome = chromeObject;
  Object.defineProperty(host, globalName, { value: { sent, deliver }, configurable: true });
}
