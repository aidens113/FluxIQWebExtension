import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../shared/browser";
import { STORAGE_KEYS } from "../../shared/constants";
import { handleExtensionInstalled } from "../extension-installed";

// Saved state that changes while the install handler runs: a read answers what
// was stored when it was asked, on a later turn, as the browser's storage does.
function withStorage(run: (stored: Record<string, unknown>, writes: string[]) => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const stored: Record<string, unknown> = {};
  const writes: string[] = [];
  const later = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 0));
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: {
    get: (keys: string | string[]) => {
      const answer: Record<string, unknown> = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) if (stored[key] !== undefined) answer[key] = structuredClone(stored[key]);
      return later(answer);
    },
    set: (values: Record<string, unknown>) => {
      writes.push(...Object.keys(values));
      Object.assign(stored, structuredClone(values));
      return later(undefined);
    }
  } } } });
  return run(stored, writes).finally(() => {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  });
}

test("settings and a client id saved while the install handler runs are kept, and the side panel opens from the toolbar", async () => {
  await withStorage(async (stored, writes) => {
    let sidePanelEnabled = 0;
    const installed = handleExtensionInstalled({ enableSidePanel: async () => { sidePanelEnabled += 1; } });
    // A freshly installed worker is still starting when the saved state changes:
    // a settings save, and the client id a paired browser already holds.
    const saved = { ...defaultSettings(), gatewayUrl: "ws://127.0.0.1:4999/client", autoReconnect: false };
    stored[STORAGE_KEYS.settings] = saved;
    stored[STORAGE_KEYS.clientId] = "extension-paired-before";
    await installed;
    assert.deepEqual(stored[STORAGE_KEYS.settings], saved, "the install handler did not replace the saved settings with what it read before the save");
    assert.equal(stored[STORAGE_KEYS.clientId], "extension-paired-before", "the install handler did not replace the client id");
    assert.deepEqual(writes, [], "the install handler writes no saved state: settings read with defaults, and the worker's start-up creates the client id");
    assert.equal(sidePanelEnabled, 1);
  });
});
