import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule } from "@fluxiq-web-extension/test-contracts";
import { shellScript } from "../client/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS, bigboxRetailScenario } from "../index.js";
import { START_FACTS } from "../manifest/index.js";
import { createBigboxState, mutateBigboxState } from "../state/index.js";
import { bigboxClasses } from "../theme/index.js";
import type { BigboxState } from "../types.js";

const { manifest, render } = bigboxRetailScenario;
const context = { runToken: "bigbox-retail-test-token", seed: 239, alternateOrigin: "http://127.0.0.1:9" };
const apply = (state: BigboxState, ...operations: Array<[string, unknown]>) => operations.reduce((current, [operation, payload]) => mutateBigboxState(current, operation, payload), state);
const home = (state: BigboxState) => render(state, context);

const VARIANT_ID = "store-remembered";
const MILLBROOK = "Millbrook Crossing Supercenter";
const MILLBROOK_ID = "1187";
/** What the recording's opening steps report before the store step: the consent answered and the email offer declined. */
const OPENING: Array<[string, unknown]> = [["consent", { choice: "accept" }], ["dismiss-promo", {}]];

const variant = () => manifest.variants?.find((candidate) => candidate.id === VARIANT_ID);
const armed = () => apply(createBigboxState(), [variant()!.arm.operation, variant()!.arm.payload ?? {}]);

/** The store card a store's name heads, in the picker's shadow root. */
function storeCard(html: string, name: string): string {
  const card = html.match(new RegExp(`<li [^>]*><strong>${name}</strong>.*?</li>`, "u"))?.[0];
  assert.ok(card, `the picker lists ${name}`);
  return card;
}

/**
 * The page's actionable controls by accessible name, in document order:
 * buttons and links by their text, form fields by their label. The page is
 * server-rendered whole, shadow roots included, so this is every control a
 * Flow step's target can resolve to before the page's own script runs.
 */
function controlNames(html: string): string[] {
  const names: string[] = [];
  const control = /<(button|a)\b[^>]*>(.*?)<\/\1>|<(input|select|textarea)\b([^>]*)>/gsu;
  for (const match of html.matchAll(control)) {
    if (match[1]) names.push(`${match[1]}:${match[2]!.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ").trim()}`);
    else names.push(`${match[3]}:${/aria-label="([^"]*)"/u.exec(match[4]!)?.[1] ?? /name="([^"]*)"/u.exec(match[4]!)?.[1] ?? ""}`);
  }
  return names;
}

test("the store-remembered variant is declared on the pickup cart, armed by one operation, and resolves", () => {
  const declared = variant();
  assert.ok(declared, "the primary workflow declares store-remembered");
  assert.deepEqual(declared.arm, { operation: "remember-pickup-store" });
  const resolved = resolveScenarioWorkflow(manifest, { variantId: VARIANT_ID });
  assert.equal(resolved.expected.failure, undefined);
  assert.deepEqual(resolved.expected.finalState, manifest.expected.finalState, "the cart the run must end with is unchanged");
  const afterArm = scenarioPageFactSchedule(manifest, { variantId: VARIANT_ID }, "arms-after-loading").afterArm;
  assert.deepEqual(afterArm.map((fact) => [fact.subject, fact.value]), [["mini-cart-store", `Pickup store: ${MILLBROOK}`], ["mini-cart-summary", "1 item · Subtotal $3.97"]]);
});

test("on the base site the recorded store step has its control: Millbrook's card offers Set as my store", () => {
  const step = manifest.recordingScript.find((candidate) => candidate.id === "choose-millbrook");
  assert.equal(step?.target, `vr-fulfillment-picker li:has(strong:text-is("${MILLBROOK}")) button`);
  assert.match(storeCard(home(createBigboxState()), MILLBROOK), /<button [^>]*>Set as my store<\/button>/u);
});

test("the armed site omits that control: the site already remembers Millbrook as the shopper's store", () => {
  const card = storeCard(home(armed()), MILLBROOK);
  assert.doesNotMatch(card, /<button\b/u, "nothing in Millbrook's card is a button for the recorded step to press");
  assert.match(card, />Your store</u);
  assert.equal(armed().storeId, MILLBROOK_ID);
});

test("the armed start page is the base site's page right after the store step, by path and by every control name", () => {
  // The steps before the store step answer dialogs on the start page and never leave it,
  // and Set as my store reloads the page it is on, so the step ends on the start path.
  const script = manifest.recordingScript;
  const before = script.slice(0, script.findIndex((step) => step.id === "choose-millbrook"));
  assert.deepEqual(before.map((step) => step.operation), ["click", "waitForState", "click", "click"], "no step before it navigates");
  assert.match(shellScript({ runToken: context.runToken, classes: bigboxClasses("baseline", context.seed), kind: "home", consent: "accepted", promo: "dismissed", chatCard: "pending", tileDefaults: {} }), /mutate\('set-store', \{ storeId: STORE_IDS\[index\] \}\);\s*location\.reload\(\);/u);
  assert.equal(bigboxRetailScenario.startPath, manifest.startPath);

  for (const [label, prior] of [["a fresh visit", []], ["after the opening steps", OPENING]] as const) {
    const performed = home(apply(createBigboxState(), ...prior, ["set-store", { storeId: MILLBROOK_ID }]));
    const met = home(apply(armed(), ...prior));
    assert.deepEqual(controlNames(met), controlNames(performed), `${label}: the same controls by name`);
    assert.equal(met, performed, `${label}: the same page, byte for byte`);
  }
  assert.notDeepEqual(controlNames(home(createBigboxState())), controlNames(home(armed())), "and the unarmed start page differs");
});

test("arming starts the shopper over at the remembered store, so an armed run's oracle is its own", () => {
  const dirty = apply(createBigboxState(), ...OPENING, ["add-to-cart", { productId: "418831402", sku: "5530102", qty: 1, fulfilment: "pickup" }]);
  const rearmed = apply(dirty, ["remember-pickup-store", {}]);
  assert.deepEqual(rearmed, { ...createBigboxState(), storeId: MILLBROOK_ID });
  assert.deepEqual(START_FACTS.map((fact) => fact.subject), ["mini-cart-store", "mini-cart-summary"]);
});

// A Flow built from chat on the base site meets the remembered store only at
// playback, so the live catalog arms the variant after the build (t243 open
// item 1): the runtime has to route by page state past `choose-millbrook`.
test("the live catalog builds the pickup cart on the base site and plays it back with the store remembered", () => {
  const row = BIGBOX_RETAIL_LIVE_TASKS.find((task) => task.id === "bigbox-retail-pickup-cart-store-remembered-after-creation");
  const base = BIGBOX_RETAIL_LIVE_TASKS.find((task) => task.id === "bigbox-retail-pickup-cart");
  assert.ok(row && base, "the row is in the catalog");
  assert.deepEqual({ ...row, id: base.id }, { ...base, variantId: VARIANT_ID, variantArmedAfterBuild: true }, "the same instruction and judge as the base row, armed only for playback");
  assert.ok(variant(), "the variant it arms exists");
});
