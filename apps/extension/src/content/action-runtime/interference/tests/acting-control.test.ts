// Which control on a layer the clearing may press, by class (t401): a control
// whose effect is to dismiss is pressed, and one that retries, confirms,
// submits, accepts, signs up or goes on never is -- by its own label, by the
// name of the button around it, or by its role.

import assert from "node:assert/strict";
import test from "node:test";
import { actsOnPress } from "../press-guard";
import { dismissControlIn } from "../way-out";
import { h, type FakeElement } from "./fake-layer";

/** A modal dialog holding `body` text and the given controls. */
function dialog(body: string, controls: FakeElement[]): FakeElement {
  return h("div", { role: "dialog", "aria-modal": "true" }, [h("p", {}, body), h("div", {}, controls)]);
}

const button = (label: string, attrs: Record<string, string> = {}): FakeElement => h("div", { role: "button", tabindex: "0", ...attrs }, label);

test("a control whose effect is to dismiss is the way out: Close, a close glyph, Not now, No thanks", () => {
  for (const label of ["Close", "×", "Not now", "No thanks", "No thanks, I would rather pay full price", "Maybe later", "Dismiss"]) {
    const control = button(label);
    assert.equal(dismissControlIn(dialog("Get notified when friends post.", [control])), control, label);
  }
});

test("OK is a way out on a rate-limit notice", () => {
  const ok = button("OK");
  assert.equal(dismissControlIn(dialog("You're going too fast. You can try again in 4 seconds.", [ok])), ok);
});

test("a control that retries, confirms, submits, accepts, signs up or goes on is never a way out", () => {
  for (const label of ["Try again", "Retry", "Continue", "Confirm", "Accept", "Accept all", "Yes", "Sign up", "Subscribe", "Submit", "Send", "Turn on"]) {
    assert.equal(dismissControlIn(dialog("You're going too fast. You can try again in 4 seconds.", [button(label)])), undefined, label);
  }
});

test("a close glyph inside a button named Retry, or Try again, is not a way out", () => {
  const retry = h("button", { type: "button", "aria-label": "Retry" }, [h("span", {}, "×")]);
  const tryAgain = h("button", { type: "button", "aria-label": "Try again" }, [h("span", {}, "×")]);
  assert.equal(dismissControlIn(dialog("Something happened.", [retry])), undefined);
  assert.equal(dismissControlIn(dialog("Something happened.", [tryAgain])), undefined);
});

test("a control named Close whose own text confirms is not a way out", () => {
  assert.equal(dismissControlIn(dialog("Your request.", [button("Confirm request", { "aria-label": "Close" })])), undefined);
});

test("a dismissal that would submit a form is not a way out, unless the form only closes its dialog", () => {
  const inForm = h("button", {}, "No thanks");
  assert.equal(dismissControlIn(dialog("Join our list.", [h("form", {}, [h("input", { type: "email" }), inForm])])), undefined);
  const typedSubmit = h("button", { type: "submit" }, "Close");
  assert.equal(dismissControlIn(dialog("Join our list.", [h("form", {}, [typedSubmit])])), undefined);
  const plainButton = h("button", { type: "button" }, "No thanks");
  assert.equal(dismissControlIn(dialog("Join our list.", [h("form", {}, [plainButton])])), plainButton);
  const dialogForm = h("button", {}, "Close");
  assert.equal(dismissControlIn(dialog("A notice.", [h("form", { method: "dialog" }, [dialogForm])])), dialogForm);
});

test("a control that toggles a state of its own is not a way out", () => {
  assert.equal(actsOnPress(h("div", { role: "switch", "aria-label": "Hide" })), true);
  assert.equal(actsOnPress(h("div", { role: "checkbox", "aria-label": "Skip" })), true);
  assert.equal(actsOnPress(h("input", { type: "checkbox", "aria-label": "Not now" })), true);
  assert.equal(actsOnPress(button("Not now")), false);
});

test("declining optional cookies is still a way out on a consent layer, and accepting never is", () => {
  const reject = button("Reject all");
  assert.equal(dismissControlIn(dialog("We use cookies to improve your experience.", [button("Accept all"), reject])), reject);
  const without = button("Continue without accepting");
  assert.equal(dismissControlIn(dialog("We use cookies.", [without])), without);
});
