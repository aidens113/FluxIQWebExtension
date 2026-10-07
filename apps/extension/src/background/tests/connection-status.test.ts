// Coverage of FluxIQConnection.status()'s `paired` flag: true exactly when a
// pairing token is stored, and the token itself never in the status, which is
// pushed to every open panel.

import assert from "node:assert/strict";
import test from "node:test";

import type { FluxIQSettings } from "../../shared/protocol";
import { FluxIQConnection } from "../connection";
import { OverlayTarget } from "../activity/index";

const settings: FluxIQSettings = {
  gatewayUrl: "ws://127.0.0.1:4777/client",
  coreApiUrl: "http://127.0.0.1:3000",
  autoReconnect: true,
  captureMutations: true,
  captureInputValues: true,
  captureSnapshots: true,
  requestsEnabled: false
};

test("a stored token makes the browser paired, and the token never appears in the status", () => {
  const token = "secret-pairing-token";
  const paired = new FluxIQConnection(settings, { clientId: "client-1", token, sessionId: "s-1", projectId: "p-1" });
  const status = paired.status();
  assert.equal(status.paired, true);
  assert.equal(status.connectionState, "disconnected");
  assert.ok(!JSON.stringify(status).includes(token));
  assert.equal(paired.isPaired(), true);
  assert.equal(paired.projectId(), "p-1");
});

test("no stored token is not paired", () => {
  const fresh = new FluxIQConnection(settings, { clientId: "client-1" });
  assert.equal(fresh.status().paired, false);
  assert.equal(fresh.isPaired(), false);
});

/** t174-w86 note 1: the overlay is drawn on every tab in front, so the relay asks the overlay target for all of them. */
test("the activity relay draws the overlay on the tabs the overlay target resolves", async (t) => {
  t.mock.method(OverlayTarget.prototype, "resolveAll", async () => [7, 9]);
  const connection = new FluxIQConnection(settings, { clientId: "client-1" });
  const deps = (connection as unknown as { activity: { deps: { overlayTabIds?: () => Promise<readonly number[]> } } }).activity.deps;
  assert.deepEqual(await deps.overlayTabIds?.(), [7, 9]);
});
