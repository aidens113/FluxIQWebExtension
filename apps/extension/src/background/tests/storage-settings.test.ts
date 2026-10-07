import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../shared/browser";
import { STORAGE_KEYS } from "../../shared/constants";
import { readSettings, writeSettings } from "../storage";

test("actual settings writes and legacy saved-state repair always persist requests OFF", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const stored: Record<string, unknown> = {};
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: {
    get: async (key: string) => ({ [key]: stored[key] }),
    set: async (values: Record<string, unknown>) => { Object.assign(stored, values); }
  } } } });
  try {
    await writeSettings({ ...defaultSettings(), requestsEnabled: true });
    assert.equal((stored[STORAGE_KEYS.settings] as { requestsEnabled: boolean }).requestsEnabled, false);
    stored[STORAGE_KEYS.settings] = { ...defaultSettings(), requestsEnabled: true, captureSnapshots: false };
    assert.equal((await readSettings()).requestsEnabled, false);
    assert.equal((stored[STORAGE_KEYS.settings] as { requestsEnabled: boolean }).requestsEnabled, false);
    assert.equal((await readSettings()).captureSnapshots, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  }
});
