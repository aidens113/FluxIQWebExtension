import assert from "node:assert/strict";
import test from "node:test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { ADMIN_CONSOLE_TARGET } from "../manifest.js";
import { SHORT_BOOK_SIZE } from "../records.js";
import type { AdminConsoleState } from "../types.js";

/**
 * The console's server side, driven over HTTP exactly as its client script and
 * the Testing Lab drive it: deep links through the route, the client's
 * operations and variant arms through `/api/admin-console/<operation>`, and the
 * oracle through `/__control/final-state`. These replace the server-side halves
 * of the retired browser spec; the browser halves (virtualised rows, the shadow
 * root, same-document routing) are fixture behaviour no browser test may open.
 */

const CONSOLE = "/scenarios/admin-console/";

async function withLab(run: (lab: RunningScenarioLab, io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "admin-console-lab-server-token", seed: 42 });
  try { await run(lab, client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    get: async (path: string, method = "GET") => {
      const response = await fetch(`${lab.origin}${path}`, { method });
      return { status: response.status, body: await response.text() };
    },
    post: async (operation: string, payload: unknown) => {
      const response = await fetch(`${lab.origin}/api/admin-console/${operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await response.json() as { mutation: { status: string } };
      return { status: response.status, mutation: body.mutation.status };
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=admin-console`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: AdminConsoleState }).state;
    },
  };
}

test("over HTTP, a deep link records the one route a request produced, HEAD records nothing, and an unknown record is 404", async () => withLab(async (_lab, io) => {
  const head = await io.get(`${CONSOLE}records/${ADMIN_CONSOLE_TARGET}`, "HEAD");
  assert.equal(head.status, 200);
  assert.deepEqual((await io.state()).openedRecordIds, [], "HEAD must not record a route");

  const served = await io.get(`${CONSOLE}records/${ADMIN_CONSOLE_TARGET}`);
  assert.equal(served.status, 200);
  assert.equal(served.body, (await io.get(CONSOLE)).body, "a deep link serves the same console the start path does");
  const state = await io.state();
  assert.deepEqual(state.openedRecordIds, [ADMIN_CONSOLE_TARGET]);
  assert.equal(state.lastOperation, "route-changed");
  assert.equal(state.oracle.routePath, `${CONSOLE}records/${ADMIN_CONSOLE_TARGET}`);

  assert.equal((await io.get(`${CONSOLE}records/CUS-9999`)).status, 404);
  assert.deepEqual((await io.state()).openedRecordIds, [ADMIN_CONSOLE_TARGET], "a 404 records nothing");
}));

test("over HTTP, the primary workflow's operations reach the oracle the manifest's final state describes", async () => withLab(async (_lab, io) => {
  assert.deepEqual(await io.post("open-record", { recordId: ADMIN_CONSOLE_TARGET }), { status: 200, mutation: "changed" });
  assert.deepEqual(await io.post("save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "mrr", value: "$5,400.00" }] }), { status: 200, mutation: "changed" });
  const saved = await io.state();
  assert.deepEqual(saved.openedRecordIds, [ADMIN_CONSOLE_TARGET]);
  assert.deepEqual(saved.savedEdits, { [ADMIN_CONSOLE_TARGET]: [{ field: "mrr", value: "$5,400.00" }] });
  assert.equal(saved.oracle.savedCount, 1);
  assert.equal(saved.oracle.routePath, `${CONSOLE}records/${ADMIN_CONSOLE_TARGET}`);
  // A field the console does not edit is refused server side, whatever a client posts.
  assert.deepEqual(await io.post("save-record", { recordId: ADMIN_CONSOLE_TARGET, fields: [{ field: "plan", value: "Scale" }] }), { status: 200, mutation: "no_change" });
}));

test("over HTTP, the settings workflow records the digest preference and the replaced tab route", async () => withLab(async (_lab, io) => {
  await io.post("navigate-route", { view: "settings", tab: "notifications" });
  await io.post("set-preference", { preference: "weeklyDigest", value: true });
  const state = await io.state();
  assert.equal(state.oracle.weeklyDigest, true);
  assert.equal(state.oracle.routePath, `${CONSOLE}settings?tab=notifications`);
}));

test("over HTTP, each variant's arm is accepted and changes the console the next request serves", async () => withLab(async (_lab, io) => {
  assert.deepEqual(await io.post("set-variant", { variant: "short-book" }), { status: 200, mutation: "changed" });
  const short = await io.get(CONSOLE);
  assert.match(short.body, new RegExp(`<p data-testid="list-summary" role="status">${SHORT_BOOK_SIZE} records</p>`));
  assert.equal((await io.state()).oracle.recordCount, SHORT_BOOK_SIZE);
  assert.equal((await io.get(`${CONSOLE}records/${ADMIN_CONSOLE_TARGET}`)).status, 404, "the short book does not hold the target");

  await io.post("set-variant", { variant: "read-only" });
  assert.match((await io.get(CONSOLE)).body, /data-testid="read-only-banner"/);

  await io.post("set-variant", { variant: "light-dom-toggle" });
  const light = (await io.get(CONSOLE)).body;
  assert.equal(light.includes("<fx-toggle"), false);
  assert.match(light, /role="switch" aria-checked="false" aria-label="Weekly digest email" data-testid="digest-toggle"/);
  await io.post("set-preference", { preference: "weeklyDigest", value: true });
  assert.equal((await io.state()).oracle.weeklyDigest, true);
  assert.deepEqual(await io.post("set-variant", { variant: "bogus" }), { status: 200, mutation: "no_change" });
}));
