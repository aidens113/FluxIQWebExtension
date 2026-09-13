import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { storefrontCheckoutScenario } from "../scenario.js";
import { syntheticCheckoutValues } from "../manifest.js";
import { formatMoney, storefrontOrder } from "../order.js";
import type { StorefrontCheckoutState } from "../state.js";

const { createState, mutate, render, manifest, route } = storefrontCheckoutScenario;
const context = { runToken: "storefront-checkout-token", seed: 131 };
const initial = (): StorefrontCheckoutState => createState(131);
const startPage = (state = initial()): string => render(state, context);

function cardFramePage(state = initial()): string {
  const response = route?.(state, { subpath: "payment-frame", query: new URLSearchParams(), method: "GET" }, context);
  assert.equal(response?.status, 200);
  return response?.body ?? "";
}

/** Drives a whole checkout through the mutations the page performs, in order. */
function completedCheckout(gateway: "approve" | "decline"): StorefrontCheckoutState {
  let state = initial();
  if (gateway === "decline") state = mutate(state, "decline-next-payment", {});
  state = mutate(state, "set-consent", { choice: "all" });
  state = mutate(state, "apply-promotion", { code: "TRAIL10" });
  state = mutate(state, "confirm-cart", {});
  state = mutate(state, "lookup-address", { postcode: syntheticCheckoutValues.postcode });
  state = mutate(state, "choose-address", { addressId: state.address.suggestionIds[1] ?? "" });
  state = mutate(state, "confirm-address", {});
  state = mutate(state, "choose-delivery", { optionId: "express" });
  state = mutate(state, "confirm-delivery", {});
  return mutate(state, "submit-payment", { cardNumber: syntheticCheckoutValues.cardNumber });
}

test("manifest is valid, loopback-only, and carries one declined-card variant", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath], ["storefront-checkout", 131, "/scenarios/storefront-checkout/"]);
  assert.deepEqual(manifest.capabilities, ["forms", "iframe", "mutation"]);
  assert.deepEqual(manifest.variants?.map(variant => variant.id), ["declined-card"]);
  assert.equal(manifest.workflows, undefined);
  assert.equal(resolveScenarioWorkflow(manifest, { variantId: "declined-card" }).expected.failure?.category, "unexpected_state");
  // A variant states the facts of its own rendering rather than inheriting the
  // workflow's: the two lists are equal here, but both are written down.
  assert.deepEqual(manifest.variants?.[0]?.expected.pageFacts, manifest.expected.pageFacts);
});

test("a secret is declared for every marked sensitive field, and for no unmarked one", () => {
  assert.deepEqual(manifest.secrets?.map(secret => secret.step), ["enter-card-number", "enter-billing-card-number", "enter-account-password"]);
  const frame = cardFramePage();
  // The declared steps type into fields a sensitivity rule can see...
  assert.match(frame, /data-testid="card-number"[^>]*autocomplete="cc-number"/);
  assert.match(frame, /data-testid="billing-card-number"[^>]*autocomplete="billing cc-number"/);
  assert.match(startPage(), /data-testid="account-password"[^>]*type="password"/);
  // ...and the security-code step is deliberately absent from that list,
  // because the field it types into carries no marking to withhold it by.
  assert.equal(manifest.secrets?.some(secret => secret.step === "enter-security-code"), false);
});

test("the page ships card-shaped fields the way real sites mark them, including the ones they miss", () => {
  const frame = cardFramePage();
  const securityCode = /<input id="card-security-code"[^>]*>/u.exec(frame)?.[0] ?? "";
  assert.ok(securityCode, "the security-code field is rendered");
  assert.doesNotMatch(securityCode, /autocomplete/u, "the security code carries no autocomplete at all; that is the trap");
  assert.match(securityCode, /inputmode="numeric"/u);
  const giftCard = /<input id="gift-card-number"[^>]*>/u.exec(startPage())?.[0] ?? "";
  assert.ok(giftCard, "the gift-card field is rendered");
  assert.doesNotMatch(giftCard, /autocomplete/u, "a card-shaped field in the top document with no marking either");
  assert.match(giftCard, /inputmode="numeric"/u);
});

test("class names are generated rather than authored, so identity cannot lean on them", () => {
  const html = startPage();
  const classes = new Set([...html.matchAll(/class="([^"]+)"/gu)].flatMap(match => (match[1] ?? "").split(" ")).filter(Boolean));
  assert.ok(classes.size > 10, `expected a page built from many generated classes, saw ${classes.size}`);
  for (const name of classes) {
    assert.match(name, /^(css-[a-z0-9]+|sc-[A-Za-z]+|_cmp-[a-z0-9]+)$/u, `class "${name}" reads as authored, not generated`);
  }
});

test("the first rendering is the one the manifest describes: consent over a scrim, one embedded frame, one open step", () => {
  const html = startPage();
  assert.match(html, /data-testid="cookie-consent-scrim"/u);
  assert.match(html, /data-testid="cookie-consent"[^>]*role="dialog"[^>]*aria-modal="true"/u);
  assert.match(html, /data-testid="support-chat-launcher"/u);
  assert.equal(html.match(/<iframe /gu)?.length, 1);
  assert.match(html, /<iframe title="Secure card payment" data-testid="payment-frame" src="payment-frame"/u);
  assert.match(html, /data-testid="step-cart-body"(?! hidden)/u);
  for (const step of ["address", "delivery", "payment"]) assert.match(html, new RegExp(`data-testid="step-${step}-body" hidden`, "u"));
  assert.match(html, /data-testid="order-confirmation"[^>]*hidden/u);
  assert.match(html, /data-testid="checkout-progress">Step 1 of 4</u);
});

test("every recording-script target and fact subject names something the documents render", () => {
  const workflow = resolveScenarioWorkflow(manifest);
  const declined = resolveScenarioWorkflow(manifest, { variantId: "declined-card" });
  // A checkout is a sequence of renderings, so a target is checked against
  // every rendering the workflow passes through: the consent dialog is gone by
  // the end, and the suggestion list does not exist at the start.
  const midway = (() => {
    let state = mutate(initial(), "confirm-cart", {});
    state = mutate(state, "lookup-address", { postcode: syntheticCheckoutValues.postcode });
    return render(mutate(state, "choose-address", { addressId: "addr-9582" }), context);
  })();
  const top = [startPage(), midway, render(completedCheckout("approve"), context)];
  const frame = cardFramePage();
  const FRAME_PREFIX = "frame:Secure card payment/";
  for (const step of workflow.recordingScript) {
    if (step.target === undefined) continue;
    const inFrame = step.target.startsWith(FRAME_PREFIX);
    const target = inFrame ? step.target.slice(FRAME_PREFIX.length) : step.target;
    assert.ok(target.startsWith("testid:"), `${step.id} addresses by test id`);
    const pattern = new RegExp(`data-testid="${target.slice("testid:".length)}"`, "u");
    const documents = inFrame ? [frame] : top;
    assert.ok(documents.some(html => pattern.test(html)), `${step.id}: no rendering of this workflow contains ${step.target}`);
  }
  for (const fact of [...(workflow.expected.pageFacts ?? []), ...(workflow.expected.finalState ?? []), ...(declined.expected.finalState ?? [])]) {
    if (fact.subject === "document") continue;
    const pattern = new RegExp(`data-testid="${fact.subject}"`, "u");
    // `exists: false` is the one fact whose subject is meant to be absent from
    // the rendering it describes.
    const documents = fact.predicate === "exists" && fact.value === false ? [startPage()] : top;
    assert.ok(documents.some(html => pattern.test(html)), fact.id);
  }
});

test("state and markup are deterministic; only the order reference follows the seed", () => {
  assert.deepEqual(createState(131), createState(131));
  assert.equal(render(createState(42), context), render(createState(42), context));
  assert.equal(createState(42).order.reference, "NLO-00042-7731");
  assert.equal(createState(131).order.reference, "NLO-00131-7731");
  const stripped = (seed: number) => JSON.stringify({ ...createState(seed), order: null });
  assert.equal(stripped(42), stripped(131));
  assert.doesNotMatch(render(createState(131), context), /Math\.random|Date\.now|new Date\(/u);
});

test("the checkout advances one step at a time and refuses to skip", () => {
  let state = initial();
  assert.equal(state.step, "cart");
  assert.equal(mutate(state, "confirm-address", {}).step, "cart", "a step cannot be reached out of order");
  assert.equal(mutate(state, "submit-payment", {}).payment.attempts, 0, "payment cannot be taken before the payment step");
  state = mutate(state, "confirm-cart", {});
  assert.equal(state.step, "address");
  assert.equal(mutate(state, "confirm-address", {}).step, "address", "no address chosen yet");
  state = mutate(state, "lookup-address", { postcode: "97205" });
  assert.deepEqual(state.address.suggestionIds, ["addr-9581", "addr-9582", "addr-9583"]);
  assert.equal(state.address.lookups, 1);
  assert.equal(mutate(state, "choose-address", { addressId: "addr-0000" }).address.chosenId, null);
  state = mutate(state, "choose-address", { addressId: "addr-9582" });
  state = mutate(state, "confirm-address", {});
  assert.equal(state.step, "delivery");
  assert.equal(mutate(state, "confirm-delivery", {}).step, "delivery", "no delivery option chosen yet");
  state = mutate(state, "choose-delivery", { optionId: "express" });
  assert.equal(state.status.deliveryEstimate, storefrontOrder.deliveryOptions[1]?.estimate);
  state = mutate(state, "confirm-delivery", {});
  assert.equal(state.step, "payment");
});

test("an unknown postcode answers with no addresses, and a fresh lookup drops the chosen one", () => {
  let state = mutate(initial(), "confirm-cart", {});
  state = mutate(state, "lookup-address", { postcode: "97205" });
  state = mutate(state, "choose-address", { addressId: "addr-9581" });
  assert.equal(state.address.chosenId, "addr-9581");
  const elsewhere = mutate(state, "lookup-address", { postcode: "99999" });
  assert.deepEqual(elsewhere.address.suggestionIds, []);
  assert.equal(elsewhere.address.chosenId, null);
  assert.equal(elsewhere.address.lookups, 2);
});

test("the promotion is honoured once and priced from the item subtotal", () => {
  const subtotal = storefrontOrder.items.reduce((total, item) => total + item.unitCents * item.quantity, 0);
  assert.equal(subtotal, 36_900);
  const applied = mutate(initial(), "apply-promotion", { code: " trail10 " });
  assert.equal(applied.promotion.applied, true);
  assert.equal(applied.totals.discountCents, 3_690);
  assert.equal(applied.status.total, formatMoney(33_210));
  const rejected = mutate(initial(), "apply-promotion", { code: "NOPE" });
  assert.equal(rejected.promotion.applied, false);
  assert.equal(rejected.status.promotion, "That code is not valid on these items");
  const untouched = initial();
  assert.equal(mutate(untouched, "apply-promotion", { code: "   " }), untouched, "an empty code changes nothing at all");
});

test("a completed checkout places the order; an armed one is declined and stays on the payment step", () => {
  const approved = completedCheckout("approve");
  assert.equal(approved.step, "confirmed");
  assert.deepEqual(approved.payment, { gateway: "approve", attempts: 1, outcome: "approved" });
  assert.equal(approved.order.placed, true);
  assert.equal(approved.status.total, "$344.10");
  const declined = completedCheckout("decline");
  assert.equal(declined.step, "payment");
  assert.deepEqual(declined.payment, { gateway: "decline", attempts: 1, outcome: "declined" });
  assert.equal(declined.order.placed, false);
  assert.match(declined.status.payment, /declined/u);
  const html = render(declined, context);
  assert.match(html, /data-testid="payment-decline-notice" role="alert">/u, "the decline notice is shown, not hidden");
  assert.match(html, /data-testid="order-confirmation"[^>]*hidden/u);
});

test("arming returns the checkout to its first rendering, so the variant page facts describe what a run meets", () => {
  const armed = mutate(completedCheckout("approve"), "decline-next-payment", {});
  const fresh = initial();
  assert.deepEqual({ ...armed, payment: fresh.payment }, fresh);
  assert.equal(armed.payment.gateway, "decline");
  assert.equal(render(armed, context), render({ ...fresh, payment: { ...fresh.payment, gateway: "decline" } }, context), "arming changes nothing the page shows");
});

test("no card, security code, gift card or password value can reach the fixture's own state", () => {
  const secrets = Object.values(syntheticCheckoutValues);
  let state = completedCheckout("approve");
  // Every mutation the page makes, offered the values anyway.
  for (const operation of ["submit-payment", "read-order", "apply-promotion", "choose-address", "lookup-address", "set-consent", "toggle-chat"]) {
    state = mutate(state, operation, { cardNumber: syntheticCheckoutValues.cardNumber, csc: syntheticCheckoutValues.securityCode, password: syntheticCheckoutValues.password });
  }
  const serialized = JSON.stringify(state);
  for (const secret of secrets) {
    if (secret === syntheticCheckoutValues.postcode) continue;
    assert.equal(serialized.includes(secret), false, `${secret} reached the fixture state`);
  }
});

test("the route serves the card form and nothing else", () => {
  const frame = cardFramePage();
  assert.match(frame, /<title>Secure card payment<\/title>/u);
  assert.match(frame, /data-testid="pay-now">Pay \$369\.00</u);
  assert.match(frame, /data-testid="billing-card" hidden/u);
  assert.equal(route?.(initial(), { subpath: "confirmation", query: new URLSearchParams(), method: "GET" }, context), undefined);
  assert.equal(route?.(initial(), { subpath: "payment-frame/inner", query: new URLSearchParams(), method: "GET" }, context), undefined);
});

test("the overlays are in every rendering until they are dealt with, and the chat widget never leaves", () => {
  const dismissed = mutate(initial(), "set-consent", { choice: "essential" });
  assert.doesNotMatch(render(dismissed, context), /data-testid="cookie-consent"/u);
  assert.match(render(dismissed, context), /data-testid="support-chat-launcher"/u);
  assert.match(render(completedCheckout("approve"), context), /data-testid="support-chat-launcher"/u);
  assert.equal(mutate(initial(), "set-consent", { choice: "maybe" }).consent, "pending");
});

/**
 * The identifier-less renderings. Every existing fixture, this one included,
 * is authored the way a test author writes one; a production build ships a
 * page with none of that on it, and Core's score divides by the weight of the
 * signals the *recording* carried. These two policies are how a recording can
 * be made against the page a build ships. `reports/x-identifierless.md` has the
 * measurements they were built to take.
 */
test("set-identifiers arms a policy from a clean checkout and rejects anything else", () => {
  const shopping = mutate(mutate(initial(), "set-consent", { choice: "all" }), "confirm-cart", {});
  assert.equal(shopping.step, "address");
  const built = mutate(shopping, "set-identifiers", { policy: "no-test-ids" });
  assert.equal(built.identifiers, "no-test-ids");
  assert.equal(built.step, "cart", "arming a policy restarts the checkout, as decline-next-payment does");
  assert.equal(built.consent, "pending");
  assert.equal(built.order.reference, shopping.order.reference, "the order reference survives, so a reload never renumbers");
  // The two axes compose: arming a payment outcome does not reach for the policy.
  assert.equal(mutate(built, "decline-next-payment", {}).identifiers, "no-test-ids");
  assert.equal(mutate(built, "set-identifiers", { policy: "as-authored" }).identifiers, "as-authored");
  for (const payload of [{ policy: "none" }, { policy: 3 }, {}, null]) {
    assert.equal(mutate(shopping, "set-identifiers", payload), shopping);
  }
});

test("no-test-ids ships the page a production build ships, and the page still works", () => {
  const state = mutate(initial(), "set-identifiers", { policy: "no-test-ids" });
  const page = render(state, context);
  const authored = startPage();
  for (const attribute of ["data-testid", "data-test", "data-cy"]) {
    assert.equal(page.includes(`${attribute}=`), false, attribute);
  }
  // The controls are all still there, and the client still finds them: the
  // attribute is renamed, not deleted, because a fixture has no framework to
  // hold a ref for it and a deleted attribute would break the page, not model
  // a build.
  assert.equal(page.split("<button").length, authored.split("<button").length);
  assert.equal(page.split("data-fx-node=").length, authored.split("data-testid=").length);
  assert.match(page, /data-fx-node="continue-to-address"/u);
  assert.match(page, /byTestId\('continue-to-address'\)|\[data-fx-node="/u);
  // An id is left exactly as authored: a build has no reason to touch one.
  assert.match(page, /id="postcode"/u);
  assert.match(page, /for="postcode"/u);
  // The card frame is a second document under the same policy.
  assert.equal(cardFramePage(state).includes("data-testid="), false);
  assert.match(cardFramePage(state), /data-fx-node="pay-now"/u);
});

test("no-identifiers also replaces every author-stable id, and the accessibility tree survives it", () => {
  const state = mutate(initial(), "set-identifiers", { policy: "no-identifiers" });
  const page = render(state, context);
  assert.equal(page.includes("data-testid="), false);
  for (const authored of ["postcode", "address-name", "promo-code", "order-confirmation-title"]) {
    assert.equal(page.includes(`id="${authored}"`), false, authored);
  }
  // Generated ids, and every reference rewritten with them, so a label still
  // labels and an `aria-labelledby` still names.
  const ids = [...page.matchAll(/\sid="([^"]*)"/gu)].map(([, id]) => id ?? "");
  assert.ok(ids.length > 0);
  assert.deepEqual(ids.filter((id) => !/^:r\d+:$/u.test(id)), [], "every id is a generated one");
  const declared = new Set(ids);
  for (const [, value] of page.matchAll(/\s(?:for|aria-labelledby|aria-describedby|aria-controls)="([^"]*)"/gu)) {
    for (const reference of (value ?? "").split(/\s+/u)) {
      assert.ok(declared.has(reference), `${reference} is referenced but no element declares it`);
    }
  }
});
