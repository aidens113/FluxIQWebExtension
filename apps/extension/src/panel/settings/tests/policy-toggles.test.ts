// Coverage of toggle-view.ts and the form's `allow`: the settings form shows
// what Core's recording-capture policy allows, carried on the status. Under
// Core's default (no policy in the status) it is exactly `SETTING_FIELDS`.

import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionCaptureAllowed, ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelStore } from "../../state";
import { createSettingsForm } from "../address-form";
import { SETTING_FIELDS } from "../form-fields";
import { createSettingsView } from "../settings-view";
import { toggleView } from "../toggle-view";

const DEFAULT_ALLOWED: ExtensionCaptureAllowed = { captureMutations: true, captureInputValues: true, captureSnapshots: true, directRequests: false };
const STRICT: ExtensionCaptureAllowed = { captureMutations: true, captureInputValues: true, captureSnapshots: false, directRequests: true };
const field = (key: string) => SETTING_FIELDS.toggles.find((entry) => entry.key === key)!;

test("with no policy, or Core's default, every switch shows as SETTING_FIELDS lists it", () => {
  for (const entry of SETTING_FIELDS.toggles) {
    const expected = { disabled: entry.disabled === true, hint: entry.hint };
    assert.deepEqual(toggleView(entry, undefined), expected, entry.key);
    assert.deepEqual(toggleView(entry, DEFAULT_ALLOWED), expected, entry.key);
  }
});

test("a switch Core forbids is disabled with a short reason; direct requests follow directRequests.allowed", () => {
  assert.deepEqual(toggleView(field("captureSnapshots"), STRICT), { disabled: true, hint: "Turned off by FluxIQ's recording policy." });
  assert.deepEqual(toggleView(field("requestsEnabled"), STRICT), { disabled: false, hint: "Lets a Flow call a site's addresses directly." });
  assert.deepEqual(toggleView(field("autoReconnect"), STRICT), { disabled: false, hint: field("autoReconnect").hint }, "a switch Core does not govern is unaffected");
});

test("the form disables, explains and reads off a switch the policy forbids, and restores it under the default", async () => {
  await withFakeDocument(() => {
    const form = createSettingsForm();
    const root = fake(form.element);
    const find = (id: string) => root.descendants().find((node) => node.id === id)!;
    const checked = (id: string) => (find(id) as unknown as { checked: boolean }).checked;
    form.allow(STRICT);
    form.fill({ ...defaultSettings(), captureSnapshots: true, requestsEnabled: true });
    assert.equal(find("captureSnapshots").attributes.has("disabled"), true);
    assert.equal(find("captureSnapshots").disabled, true);
    assert.equal(find("captureSnapshotsHint").textContent, "Turned off by FluxIQ's recording policy.");
    assert.equal(checked("captureSnapshots"), false);
    assert.equal(find("requestsEnabled").attributes.has("disabled"), false);
    assert.equal(checked("requestsEnabled"), true);
    assert.equal(form.read().captureSnapshots, false);
    assert.equal(form.read().requestsEnabled, true);
    form.allow(undefined);
    form.fill({ ...defaultSettings(), captureSnapshots: true, requestsEnabled: true });
    assert.equal(find("captureSnapshots").attributes.has("disabled"), false);
    assert.equal(find("captureSnapshotsHint").textContent, field("captureSnapshots").hint);
    assert.equal(checked("captureSnapshots"), true);
    assert.equal(find("requestsEnabled").attributes.has("disabled"), true);
    assert.equal(find("requestsEnabledHint").textContent, "Unavailable in this version.");
    assert.equal(form.read().requestsEnabled, false);
  });
});

test("the settings screen applies the policy the status carries", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
    runtime: { lastError: undefined },
    storage: { local: { get: (_keys: string[], done: (items: object) => void) => done({}), set: () => undefined, remove: () => undefined } }
  } });
  try {
    await withFakeDocument(async () => {
      const status: ExtensionStatus = {
        connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl,
        settings: defaultSettings(), captureAllowed: STRICT, clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: []
      };
      const store = {
        current: () => status,
        subscribe(listener: (status: ExtensionStatus) => void) {
          listener(status);
          return () => undefined;
        },
        request: (async () => ({ ok: true, value: {} })) as unknown as PanelStore["request"]
      } as unknown as PanelStore;
      // Subscribing renders once, which applies the status policy.
      const view = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined);
      await Promise.resolve();
      const root = fake(view.element);
      const find = (id: string) => root.descendants().find((node) => node.id === id)!;
      assert.equal(find("captureSnapshots").attributes.has("disabled"), true);
      assert.equal(find("requestsEnabled").attributes.has("disabled"), false);
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  }
});
