// Coverage of FluxIQConnection's project-focus wiring: the panel's project
// choice (`panelProjects.choice().choose`, which the project messages use) tells Core
// `client.focus_project` on choose and on clear over a ready session, and sends
// nothing while the session is not ready.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { FluxIQSettings } from "../../shared/protocol";
import { FluxIQConnection } from "../connection";
import { GatewaySession } from "../connection/index";

const settings: FluxIQSettings = {
  gatewayUrl: "ws://127.0.0.1:4777/client",
  coreApiUrl: "http://127.0.0.1:3000",
  autoReconnect: true,
  captureMutations: true,
  captureInputValues: true,
  captureSnapshots: true,
  requestsEnabled: false
};

/** The worker's `chrome` as far as a choice reaches it: its storage and the status broadcast. */
function stubChrome(t: TestContext): void {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  const stored: Record<string, unknown> = {};
  holder.chrome = {
    storage: { local: { get: async (key: string) => ({ [key]: stored[key] }), set: async (items: Record<string, unknown>) => void Object.assign(stored, items) } },
    runtime: { sendMessage: async () => undefined }
  };
  t.after(() => {
    holder.chrome = previous;
  });
}

function focusSends(connection: FluxIQConnection): Array<{ type: string; payload: unknown }> {
  const sent: Array<{ type: string; payload: unknown }> = [];
  const gateway = (connection as unknown as { gateway: { send: (type: string, payload: unknown) => Promise<void> } }).gateway;
  gateway.send = async (type, payload) => void sent.push({ type, payload });
  return sent;
}

test("choosing a project and clearing the choice each tell Core over a ready session", async (t) => {
  stubChrome(t);
  t.mock.method(GatewaySession.prototype, "state", () => "connected");
  const connection = new FluxIQConnection(settings, { clientId: "client-1" });
  const sent = focusSends(connection);

  await connection.panelProjects.choice().choose({ projectId: "project-2", name: "Two" });
  await connection.panelProjects.choice().choose(null);

  assert.deepEqual(sent, [
    { type: "client.focus_project", payload: { projectId: "project-2" } },
    { type: "client.focus_project", payload: { projectId: null } }
  ]);
});

test("a choice made while the session is not ready is not sent then, and is not queued", async (t) => {
  stubChrome(t);
  t.mock.method(GatewaySession.prototype, "state", () => "reconnecting");
  const connection = new FluxIQConnection(settings, { clientId: "client-1" });
  const sent = focusSends(connection);

  await connection.panelProjects.choice().choose({ projectId: "project-2", name: "Two" });

  assert.deepEqual(sent, []);
  assert.equal(connection.panelProjects.choice().chosenProject(), "project-2", "the choice is held for the next ready session");
});
