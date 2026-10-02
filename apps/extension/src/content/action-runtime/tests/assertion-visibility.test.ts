// A `visible` claim about a control inside a widget's shadow root, on the pages
// a dry run meets: there behind a closed flyout, there and shown, there and
// hidden alone, and replaced by the effect of having pressed it.
//
// Lane A's run 40 (`run-muq6lqnw-fdfa7aac`) is why. The build's dry run checks
// a step whose effect lasts instead of pressing it, and asks the page through
// this claim (`domain/src/runtime/llm-evidence/node-run/verify.ts`). The claim
// asked the selector of the light document, where a selector written inside
// the store chooser's root matches nothing, so bigbox's "Set as my store" read
// as never there whether its flyout was open or closed, and the step passed as
// "already done". The rows hold that the selector is asked in the recorded
// roots, and that a control hidden by its closed flyout says so (`enclosed:`)
// where one hidden alone says what it always said.

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAssertion } from "../assertion-evaluation";
import { STORE_CARDS, installStoreChooser, plainButton } from "./store-chooser-page";

const HOSTS = ["body > header > div > vr-fulfillment-picker"] as const;
/** Millbrook's "Set as my store", as the draft recorded it: the third card's button, in the chooser's root. */
const MILLBROOK_BUTTON = "div > ul > li:nth-of-type(3) > button";
const CARDEN_FALLS = STORE_CARDS[0].id;
const MILLBROOK = STORE_CARDS[2].id;

const visible = (target: Parameters<typeof evaluateAssertion>[1]) => evaluateAssertion({ kind: "visible", timeoutMs: 0 }, target);

test("a fresh page with the chooser closed: Millbrook's button is there, hidden by the flyout, and says so", async (t) => {
  installStoreChooser(t, { chosen: CARDEN_FALLS, open: false });
  const outcome = await visible({ selector: MILLBROOK_BUTTON, shadowHosts: HOSTS });
  assert.equal(outcome.held, false);
  // Judged, not pending: the page holds the control. That is STATE_MISMATCH, not
  // the TIMEOUT a dry run reads as "not on the page".
  assert.equal(outcome.judged, true);
  assert.match(outcome.actual, /^enclosed: /u);
});

test("the same page with the chooser open: the button is visible", async (t) => {
  installStoreChooser(t, { chosen: CARDEN_FALLS, open: true });
  const outcome = await visible({ selector: MILLBROOK_BUTTON, shadowHosts: HOSTS });
  assert.equal(outcome.held, true);
  assert.equal(outcome.actual, "it is visible");
});

test("asked of the light document alone, the widget's selector matches nothing, which is how the closed flyout passed", async (t) => {
  installStoreChooser(t, { chosen: CARDEN_FALLS, open: false });
  const outcome = await visible({ selector: MILLBROOK_BUTTON });
  assert.equal(outcome.held, false);
  assert.equal(outcome.judged, false, "nothing matched: a wait in vain, which the dry run reads as not there");
});

test("Millbrook already chosen: the card says Your store in place of the button, flyout open or closed, and nothing matches", async (t) => {
  // The effect in place: the chip names the chosen store, and the chosen
  // store's card holds no button. A target replaced is not there, which the
  // dry run reads as present on the step's own page.
  for (const open of [true, false]) {
    await t.test(open ? "flyout open" : "flyout closed", async (inner) => {
      const page = installStoreChooser(inner, { chosen: MILLBROOK, open });
      assert.match(page.chip.textContent ?? "", /Millbrook Crossing Supercenter/u);
      const outcome = await visible({ selector: MILLBROOK_BUTTON, shadowHosts: HOSTS });
      assert.equal(outcome.held, false);
      assert.equal(outcome.judged, false);
      assert.match(outcome.actual, /^nothing matched /u);
    });
  }
});

test("a control hidden alone, with everything around it shown, says what a hidden control always said", async (t) => {
  // A "Follow" withdrawn beside the "Following" that replaced it.
  installStoreChooser(t, { chosen: CARDEN_FALLS, open: true, beside: () => {
    const follow = plainButton("Follow");
    follow.setAttribute("hidden", "");
    return [follow];
  } });
  const outcome = await visible({ selector: "button:nth-of-type(2)", shadowHosts: HOSTS });
  assert.equal(outcome.held, false);
  assert.equal(outcome.judged, true);
  assert.equal(outcome.actual, "it is present but not visible");
});
