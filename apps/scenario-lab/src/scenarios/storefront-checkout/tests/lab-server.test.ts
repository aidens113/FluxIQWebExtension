import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { syntheticCheckoutValues } from "../manifest.js";
import { storefrontCheckoutScenario } from "../scenario.js";
import type { StorefrontCheckoutState } from "../state.js";

/**
 * The checkout's server side, driven over HTTP exactly as its client script,
 * its card frame and the Testing Lab drive it: each step's operation and the
 * declined-card arm through `/api/storefront-checkout/<operation>`, the card
 * frame through its route, and the oracle through `/__control/final-state`.
 * These replace the server-side halves of the retired browser spec; its
 * browser halves (the consent scrim and the chat launcher intercepting clicks,
 * the late reveals, the frame posting to the top document) are fixture
 * behaviour no browser test may open.
 */

const SCENARIO = "storefront-checkout";
const { manifest } = storefrontCheckoutScenario;

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "storefront-checkout-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  const post = async (operation: string, payload: unknown = {}) => {
    const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
      method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal(response.status, 200, operation);
    return (await response.json() as { mutation: { status: string } }).mutation.status;
  };
  return {
    post,
    get: async (path: string) => {
      const response = await fetch(`${lab.origin}${path}`);
      return { status: response.status, body: await response.text() };
    },
    page: async () => (await fetch(`${lab.origin}${manifest.startPath}`)).text(),
    arm: async (variantId: string) => {
      const { variant } = resolveScenarioWorkflow(manifest, { variantId });
      assert.ok(variant, variantId);
      assert.equal(await post(variant.arm.operation, variant.arm.payload ?? {}), "changed", `arming ${variantId}`);
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: StorefrontCheckoutState }).state;
    },
    /** The checkout up to the payment step, as the recording drives it: consent, cart, address lookup, the second address, express delivery. */
    async toPayment() {
      await post("set-consent", { choice: "all" });
      await post("confirm-cart");
      await post("lookup-address", { postcode: syntheticCheckoutValues.postcode });
      await post("choose-address", { addressId: "addr-9582" });
      await post("confirm-address");
      await post("choose-delivery", { optionId: "express" });
      await post("confirm-delivery");
    },
  };
}

test("over HTTP, the whole workflow places the order, and no card or password value reaches the oracle", async () => withLab(async (io) => {
  await io.toPayment();
  // The frame posts the digits it was given; the fixture ignores them.
  await io.post("submit-payment", { cardNumber: syntheticCheckoutValues.cardNumber, csc: syntheticCheckoutValues.securityCode, password: syntheticCheckoutValues.password });
  const state = await io.state();
  assert.deepEqual(
    [state.step, state.consent, state.payment, state.delivery, state.address.postcode, state.address.chosenId, state.address.lookups, state.order.placed],
    ["confirmed", "accepted", { gateway: "approve", attempts: 1, outcome: "approved" }, { optionId: "express", calculations: 1 }, "97205", "addr-9582", 1, true],
  );
  const stored = JSON.stringify(state);
  for (const value of [syntheticCheckoutValues.cardNumber, syntheticCheckoutValues.billingCardNumber, syntheticCheckoutValues.securityCode, syntheticCheckoutValues.password]) {
    assert.equal(stored.includes(value), false, `${value} reached the fixture state`);
  }
  assert.match(await io.page(), new RegExp(`data-testid="order-reference">${state.order.reference}<`));
}));

test("over HTTP, the address lookup and the delivery quote render what the steps promise", async () => withLab(async (io) => {
  await io.post("set-consent", { choice: "all" });
  await io.post("confirm-cart");
  assert.equal(await io.post("confirm-address"), "no_change", "the address step refuses to advance with nothing chosen");
  assert.equal((await io.state()).step, "address");

  await io.post("lookup-address", { postcode: "99999" });
  assert.match(await io.page(), /data-testid="address-lookup-status" role="status">No addresses found for 99999</);
  await io.post("lookup-address", { postcode: syntheticCheckoutValues.postcode });
  assert.match(await io.page(), /data-testid="address-lookup-status" role="status">3 addresses found for 97205</);
  await io.post("choose-address", { addressId: "addr-9582" });
  assert.match(await io.page(), /data-testid="address-chosen">1120 SW Alder St, Apt 12C, Portland, OR 97205</);
  await io.post("confirm-address");

  await io.post("choose-delivery", { optionId: "express" });
  const page = await io.page();
  assert.match(page, /data-testid="delivery-cost-status" role="status">Express shipping - \$12\.00</);
  assert.match(page, /data-testid="summary-total">\$381\.00</);
}));

test("over HTTP, the chat panel's open state is the server's and survives a reload", async () => withLab(async (io) => {
  await io.post("toggle-chat", { open: true });
  assert.equal((await io.state()).support.chatOpen, true);
  assert.match(await io.page(), /data-testid="support-chat-panel">/);
  await io.post("toggle-chat", { open: false });
  assert.match(await io.page(), /data-testid="support-chat-panel" hidden/);
  assert.match(await io.page(), /data-testid="support-chat-launcher"/, "the launcher never leaves");
}));

test("over HTTP, declined-card refuses the same payment and the checkout stays on the payment step", async () => withLab(async (io) => {
  await io.arm("declined-card");
  await io.toPayment();
  await io.post("submit-payment", {});
  const state = await io.state();
  assert.deepEqual([state.step, state.payment, state.order.placed], ["payment", { gateway: "decline", attempts: 1, outcome: "declined" }, false]);
  const page = await io.page();
  assert.match(page, /data-testid="payment-decline-notice" role="alert">/);
  assert.match(page, /data-testid="order-confirmation"[^>]*hidden/);
  assert.equal((await io.get(`${manifest.startPath}payment-frame`)).status, 200);
}));
