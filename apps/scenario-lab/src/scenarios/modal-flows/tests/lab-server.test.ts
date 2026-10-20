import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { modalFlowsScenario } from "../scenario.js";
import type { ModalFlowsState } from "../state.js";

/**
 * The modal fixture's server side, driven over HTTP exactly as its client
 * script and the Testing Lab drive it: page operations and variant arms through
 * `/api/modal-flows/<operation>`, the oracle through `/__control/final-state`,
 * and a reload as a fresh GET of the start page. These replace the server-side
 * halves of the retired browser spec; its browser halves (focus trap, Escape,
 * `inert`, the consent banner intercepting clicks, the native confirm()) are
 * fixture behaviour no browser test may open.
 */

const SCENARIO = "modal-flows";
const { manifest } = modalFlowsScenario;

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "modal-flows-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    page: async () => (await fetch(`${lab.origin}${manifest.startPath}`)).text(),
    post: async (operation: string, payload: unknown = {}) => {
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      assert.equal(response.status, 200, operation);
      return (await response.json() as { mutation: { status: string } }).mutation.status;
    },
    arm: async (workflowId: string, variantId: string) => {
      const { variant } = resolveScenarioWorkflow(manifest, { workflowId, variantId });
      assert.ok(variant, variantId);
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${variant.arm.operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(variant.arm.payload ?? {}),
      });
      assert.equal(response.status, 200, `arming ${variantId}`);
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: ModalFlowsState }).state;
    },
  };
}

test("over HTTP, a cancelled invite counts and a confirmed one is recorded and survives a reload", async () => withLab(async (io) => {
  assert.equal(await io.post("cancel-invite"), "changed");
  assert.equal(await io.post("send-invite", { email: "not-an-email", role: "editor" }), "no_change");
  assert.equal(await io.post("send-invite", { email: "ada@example.test", role: "editor" }), "changed");
  const state = await io.state();
  assert.deepEqual([state.invites, state.inviteCancellations], [[{ email: "ada@example.test", role: "editor" }], 1]);
  assert.match(await io.page(), /Invitation sent to ada@example\.test \(Editor\)/);
}));

test("over HTTP, the consent workflow publishes once the banner is answered, and banner-absent renders no banner", async () => withLab(async (io) => {
  assert.match(await io.page(), /data-testid="consent-banner"/);
  await io.post("accept-cookies");
  await io.post("publish");
  assert.deepEqual([(await io.state()).consent, (await io.state()).publishCount], ["accepted", 1]);
  assert.doesNotMatch(await io.page(), /data-testid="consent-banner"/);

  await io.arm("consent-then-click", "banner-absent");
  assert.doesNotMatch(await io.page(), /data-testid="consent-banner"/);
  await io.post("publish");
  assert.deepEqual([(await io.state()).consent, (await io.state()).publishCount], ["absent", 2]);
}));

test("over HTTP, the armed interstitial opens after the first add, blocks the page across a reload, and closes", async () => withLab(async (io) => {
  await io.arm("interstitial", "armed");
  const armed = await io.page();
  assert.match(armed, /<template id="interstitial-template">/, "armed, the offer waits in a template");
  assert.doesNotMatch(armed, /data-testid="page-shell" inert/, "and does not block the page yet");
  await io.post("add-section");
  assert.deepEqual([(await io.state()).sectionCount, (await io.state()).interstitial], [1, "open"]);
  assert.equal(await io.post("add-section"), "no_change", "the open offer blocks the page");
  const reloaded = await io.page();
  assert.match(reloaded, /data-testid="page-shell" inert/);
  assert.match(reloaded, /aria-labelledby="offer-heading"/);
  await io.post("close-interstitial");
  await io.post("add-section");
  assert.deepEqual([(await io.state()).sectionCount, (await io.state()).interstitial], [2, "closed"]);
}));

test("over HTTP, the delete prompt's answers are counted and an accepted one deletes the draft", async () => withLab(async (io) => {
  await io.post("delete-draft", { confirmed: false });
  assert.deepEqual([(await io.state()).draft, (await io.state()).deletePrompts], ["active", { accepted: 0, dismissed: 1 }]);
  await io.post("delete-draft", { confirmed: true });
  assert.deepEqual([(await io.state()).draft, (await io.state()).deletePrompts], ["deleted", { accepted: 1, dismissed: 1 }]);
}));
