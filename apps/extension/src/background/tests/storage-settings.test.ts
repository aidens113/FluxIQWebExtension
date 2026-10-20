import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import { defaultSettings } from "../../shared/browser";
import { STORAGE_KEYS } from "../../shared/constants";
import { effectiveSettings } from "../capture-policy/index";
import { readSettings, writeSettings } from "../storage";

function withStorage(run: (stored: Record<string, unknown>, writes: { count: number }) => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const stored: Record<string, unknown> = {};
  const writes = { count: 0 };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: {
    get: async (key: string) => ({ [key]: stored[key] }),
    set: async (values: Record<string, unknown>) => {
      writes.count += 1;
      Object.assign(stored, values);
    }
  } } } });
  return run(stored, writes).finally(() => {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  });
}

test("a stored request choice survives a background restart read before any policy, and effective settings still clamp it", async () => {
  await withStorage(async (stored, writes) => {
    stored[STORAGE_KEYS.settings] = { ...defaultSettings(), requestsEnabled: true, captureSnapshots: false };
    const read = await readSettings();
    assert.equal(read.requestsEnabled, true, "the person's choice is read as stored");
    assert.equal(read.captureSnapshots, false);
    assert.equal(writes.count, 0, "reading wrote nothing back");
    assert.equal((stored[STORAGE_KEYS.settings] as { requestsEnabled: boolean }).requestsEnabled, true);
    assert.equal(effectiveSettings(read, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY).requestsEnabled, false, "Core's default keeps requests off where they are used");
    const allowing = { ...AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, directRequests: { allowed: true } };
    assert.equal(effectiveSettings(read, allowing).requestsEnabled, true, "a policy that allows requests finds the choice intact");
  });
});

test("settings writes keep the person's choices and store only a boolean request choice", async () => {
  await withStorage(async (stored) => {
    await writeSettings({ ...defaultSettings(), requestsEnabled: true, captureInputValues: true });
    const saved = stored[STORAGE_KEYS.settings] as { requestsEnabled: boolean; captureInputValues: boolean };
    assert.equal(saved.requestsEnabled, true);
    assert.equal(saved.captureInputValues, true);
    await writeSettings({ ...defaultSettings(), requestsEnabled: "yes" as unknown as boolean });
    assert.equal((stored[STORAGE_KEYS.settings] as { requestsEnabled: unknown }).requestsEnabled, false);
  });
});
