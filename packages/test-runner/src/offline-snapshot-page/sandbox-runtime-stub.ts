// The `chrome.runtime` the content code sees in the snapshot page, where no
// extension is loaded: the sandbox stands in for the background. Outgoing
// messages are kept as JSON copies in `scope[globalName].sent` (the content
// code's `fluxiq.contentReady` among them); `scope[globalName].deliver(message)`
// hands a message to every `onMessage` listener under Chrome's reply rules: the
// first `sendResponse` wins, a listener that returns `true` keeps the channel
// open, and otherwise nobody answered. Messages cross as JSON both ways, as
// extension messaging serializes them. It follows the content harness's stub
// (`apps/extension/e2e/content/runtime-stub.ts`), and is serialized into the
// page, so it imports nothing and refers to nothing outside its own body.

/** What `deliver` resolves with: whether a listener answered, and its answer. */
export type SandboxDelivery = { responded: boolean; response?: unknown };

export function installSandboxRuntimeStub(globalName: string, scope: object): void {
  type Listener = (message: unknown, sender: { id: string }, sendResponse: (response?: unknown) => void) => unknown;
  const listeners: Listener[] = [];
  const sent: unknown[] = [];
  const copy = (value: unknown): unknown => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
  const sender = { id: "fluxiq-offline-snapshot-page" };
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
  const deliver = (message: unknown): Promise<SandboxDelivery> => new Promise((resolve, reject) => {
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
  const host = scope as Record<string, unknown> & { chrome?: object };
  const chromeObject = host.chrome ?? {};
  Object.defineProperty(chromeObject, "runtime", { value: runtime, configurable: true, writable: true });
  host.chrome = chromeObject;
  Object.defineProperty(host, globalName, { value: { sent, deliver }, configurable: true });
}
