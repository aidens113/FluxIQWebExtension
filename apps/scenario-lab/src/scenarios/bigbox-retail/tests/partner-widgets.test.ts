import assert from "node:assert/strict";
import test from "node:test";
import { partnerWidgetsScript } from "../client/index.js";
import { partnerWidgetsStrip } from "../pages/index.js";
import { bigboxModes, bigboxRetailScenario, createBigboxState, mutateBigboxState, PARTNER_WIDGETS } from "../index.js";
import type { BigboxState } from "../types.js";

/**
 * The `partner-widgets` rendering: the product page with the store's partner
 * embeds switched on, whose job is to give the browser specs a closed shadow
 * root, a root attached to an element already in place, and a component
 * inserted with its content already inside its root, on a realistic page. The
 * default site must not change at all, and the embeds must read as a store's.
 */

const { route } = bigboxRetailScenario;
const context = { runToken: "bigbox-retail-test-token", seed: 239, alternateOrigin: "http://127.0.0.1:9" };
const PRODUCT = "ip/valueridge-essentials-select-a-size-paper-towels/418830127";
const get = (state: BigboxState, subpath: string, query = "") => route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context)!.body as string;
const armed = () => mutateBigboxState(createBigboxState(), "set-mode", { mode: "partner-widgets" });
const W = PARTNER_WIDGETS;
const visibleText = (markup: string) => markup.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");
const WORDS = [W.payOverTime.link, W.payOverTime.offer, W.payOverTime.details, W.deliveryEstimate.link, W.deliveryEstimate.text, W.reviewHighlights.link, W.reviewHighlights.text];

test("partner-widgets is armed through set-mode, starts the shopper over, and is never the default", () => {
  assert.ok(bigboxModes.includes("partner-widgets"));
  assert.ok(bigboxModes.includes("account-recovery"), "the other spec rendering stays");
  assert.equal(createBigboxState().mode, "baseline");
  const answered = mutateBigboxState(createBigboxState(), "consent", { choice: "accept" });
  assert.deepEqual(mutateBigboxState(answered, "set-mode", { mode: "partner-widgets" }), createBigboxState("partner-widgets"));
  assert.equal(mutateBigboxState(armed(), "dismiss-promo", {}).mode, "partner-widgets", "the rendering survives the shopper's own operations");
});

test("the baseline product page carries none of the embeds, their tags or their words", () => {
  const body = get(createBigboxState(), PRODUCT);
  for (const absent of [W.payOverTime.tag, W.deliveryEstimate.tag, W.reviewHighlights.tag, "attachShadow", ...WORDS]) assert.ok(!body.includes(absent), absent);
});

test("the rendering changes the product page only by its strip and its script; every other page is the baseline's byte for byte", () => {
  const baseline = createBigboxState();
  const partner = armed();
  for (const [subpath, query] of [["search", "q=paper+towels"], ["cart", ""], ["checkout", ""], ["weekly-ad", ""], ["seller/harlow-home-goods", ""]] as const) {
    assert.equal(get(partner, subpath, query), get(baseline, subpath, query), subpath);
  }
  assert.equal(bigboxRetailScenario.render(partner, context), bigboxRetailScenario.render(baseline, context), "home");
  const page = get(partner, PRODUCT);
  const script = `\n${partnerWidgetsScript()}`;
  assert.equal(page.split(script).length - 1, 1, "the widget script runs once, after the product page's own");
  assert.equal(page.split(partnerWidgetsStrip()).length - 1, 1, "the strip is on the page once");
  assert.equal(page.replace(partnerWidgetsStrip(), "").replace(script, ""), get(baseline, PRODUCT));
});

test("the strip sits in the buy box: the pay-over-time host beside its link, the delivery link with no estimate yet, the review link beside an empty host", () => {
  const page = get(armed(), PRODUCT);
  const strip = partnerWidgetsStrip();
  assert.ok(page.indexOf(strip) > page.indexOf("Change store") && page.indexOf(strip) < page.indexOf("About this item"), "inside the buy box, after its live part");
  assert.match(strip, new RegExp(`<div><${W.payOverTime.tag}></${W.payOverTime.tag}> <a href="${W.payOverTime.href}">${W.payOverTime.link}</a></div>`, "u"));
  assert.match(strip, new RegExp(`<div>Getting it delivered\\? <a href="${W.deliveryEstimate.href}">${W.deliveryEstimate.link}</a></div>`, "u"));
  assert.match(strip, new RegExp(`<div>What shoppers say: <a href="${W.reviewHighlights.href}">${W.reviewHighlights.link}</a> <${W.reviewHighlights.tag}></${W.reviewHighlights.tag}></div>`, "u"));
  assert.ok(!page.includes(`<${W.deliveryEstimate.tag}`), "the estimate is inserted only when asked for");
  for (const words of [W.payOverTime.offer, W.payOverTime.details, W.deliveryEstimate.text, W.reviewHighlights.text]) {
    assert.ok(!visibleText(page).includes(words), `${words} lives only inside a shadow root`);
  }
});

test("the script attaches the offer's closed root at load, inserts the estimate after a wait, and defines the highlights only when asked", () => {
  const script = partnerWidgetsScript();
  assert.equal(script.split("attachShadow({ mode: 'closed' })").length - 1, 1, "one closed root, the offer's");
  assert.equal(script.split("attachShadow({ mode: 'open' })").length - 1, 2, "two open roots");
  assert.equal(script.split("customElements.define(").length - 1, 3);
  const highlightsClick = script.slice(script.indexOf("highlightsLink.addEventListener"));
  assert.match(highlightsClick, /setTimeout\(\(\) => \{[^]*customElements\.define\(W\.reviewHighlights\.tag/u, "the highlights element is upgraded in place, after the click");
  const deliveryClick = script.slice(script.indexOf("deliveryLink.addEventListener"), script.indexOf("highlightsLink.addEventListener"));
  assert.match(deliveryClick, /setTimeout\(\(\) => [^]*document\.createElement\(W\.deliveryEstimate\.tag\)/u, "the estimate is created, root and all, then inserted");
  assert.ok(script.indexOf(`customElements.define(W.deliveryEstimate.tag`) < script.indexOf("deliveryLink.addEventListener"), "the estimate element is defined before any click");
  assert.equal(script.split("event.preventDefault()").length - 1, 3, "every link answers in place");
  assert.equal(W.answerDelayMs, 150);
});

test("the embeds read as a store's partners: no test vocabulary in any of their words or tags", () => {
  const words = `${visibleText(partnerWidgetsStrip())} ${WORDS.join(" ")} ${W.payOverTime.tag} ${W.deliveryEstimate.tag} ${W.reviewHighlights.tag}`;
  assert.doesNotMatch(words, /synthetic|fixture|secret|sensitive|test|planted|scenario|shadow|closed|late/iu);
  for (const tag of [W.payOverTime.tag, W.deliveryEstimate.tag, W.reviewHighlights.tag]) assert.match(tag, /^[a-z]+-[a-z]+$/u, `${tag} is a valid custom element name`);
});
