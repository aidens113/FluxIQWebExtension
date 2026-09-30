// Connection settings without a DOM: the labels the Lab fills, what Save stores
// and when it reconnects, and which stored drafts are trusted.

import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus, FluxIQSettings } from "../../../shared/protocol";
import { parseConnectionDraft, savePlan, SETTING_FIELDS } from "..";

function status(connectionState: ExtensionStatus["connectionState"], settings: Partial<FluxIQSettings> = {}): ExtensionStatus {
  return {
    connectionState,
    recordingState: "idle",
    gatewayUrl: settings.gatewayUrl ?? defaultSettings().gatewayUrl,
    settings: { ...defaultSettings(), ...settings },
    clientId: "c",
    paired: true,
    queueSize: 0,
    eventCount: 0,
    recentActivities: []
  };
}

const values = (extra: Partial<FluxIQSettings> = {}): FluxIQSettings => ({ ...defaultSettings(), ...extra });

test("the settings carry the labels the audit pins and the Lab fills", () => {
  assert.deepEqual(SETTING_FIELDS.addresses.map((field) => field.label), ["FluxIQ connection address", "FluxIQ web address"]);
  assert.deepEqual(SETTING_FIELDS.toggles.map((field) => field.label), ["Reconnect automatically", "Record page changes", "Record what I type", "Record page snapshots"]);
  assert.equal(SETTING_FIELDS.toggles[2]!.hint, "Needed to replay typing. Passwords are never recorded.");
  for (const field of [...SETTING_FIELDS.addresses, ...SETTING_FIELDS.toggles]) assert.ok(field.hint.length > 0, `${field.label} has a hint`);
});

test("savePlan stores trimmed settings without reconnecting while disconnected", () => {
  const plan = savePlan(values({ gatewayUrl: "  ws://127.0.0.1:4711/client ", coreApiUrl: " http://127.0.0.1:3001 " }), status("disconnected"));
  assert.deepEqual(plan, { ok: true, reconnect: false, settings: values({ gatewayUrl: "ws://127.0.0.1:4711/client", coreApiUrl: "http://127.0.0.1:3001" }) });
});

test("savePlan reconnects when the connection address changed on a live connection", () => {
  for (const state of ["connected", "connecting", "pairing", "reconnecting", "error"] as const) {
    const plan = savePlan(values({ gatewayUrl: "ws://127.0.0.1:4711/client" }), status(state));
    assert.equal(plan.ok && plan.reconnect, true, state);
  }
});

test("savePlan does not reconnect for a changed switch or web address", () => {
  const plan = savePlan(values({ captureSnapshots: false, coreApiUrl: "http://127.0.0.1:3001" }), status("connected"));
  assert.equal(plan.ok, true);
  assert.equal(plan.ok && plan.reconnect, false);
  assert.equal(plan.ok && plan.settings.captureSnapshots, false);
});

test("savePlan refuses an address FluxIQ could never be reached at, naming the field", () => {
  assert.deepEqual(savePlan(values({ gatewayUrl: " " }), status("connected")), { ok: false, field: "gatewayUrl", sentence: "Enter the FluxIQ connection address." });
  assert.deepEqual(savePlan(values({ gatewayUrl: "http://127.0.0.1:4777/client" }), undefined), { ok: false, field: "gatewayUrl", sentence: "The FluxIQ connection address starts with ws:// or wss://." });
  assert.deepEqual(savePlan(values({ coreApiUrl: "" }), undefined), { ok: false, field: "coreApiUrl", sentence: "Enter the FluxIQ web address." });
  assert.deepEqual(savePlan(values({ coreApiUrl: "127.0.0.1:3000" }), undefined), { ok: false, field: "coreApiUrl", sentence: "The FluxIQ web address starts with http:// or https://." });
  assert.deepEqual(savePlan(values({ coreApiUrl: "not an address" }), undefined), { ok: false, field: "coreApiUrl", sentence: "The FluxIQ web address starts with http:// or https://." });
});

test("parseConnectionDraft trusts only a whole, well-typed set of settings", () => {
  const draft = values({ gatewayUrl: "ws://x/client" });
  assert.deepEqual(parseConnectionDraft(draft), draft);
  assert.deepEqual(parseConnectionDraft({ ...draft, extra: "dropped" }), draft);
  assert.equal(parseConnectionDraft(undefined), undefined);
  assert.equal(parseConnectionDraft([]), undefined);
  assert.equal(parseConnectionDraft({ ...draft, autoReconnect: "yes" }), undefined);
  const { coreApiUrl: _dropped, ...partial } = draft;
  assert.equal(parseConnectionDraft(partial), undefined);
});
