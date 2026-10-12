// The clearing end to end on a page (t401): what it presses, what it leaves,
// and what it records. The layers are social-network-feed's, as its
// `requests-script.ts` and `shell-script.ts` draw them.
//
// - The rate-limit notice offering OK and "Try again" is closed by OK, and
//   "Try again" -- which confirms the refused request -- is never pressed.
// - The notice offering only "Try again" is left alone: the wait is Core's.
// - A layer that holds the step's target, by element, by selector or by the
//   name it was recorded with, is never cleared.
// - Each press is recorded as the layer's kind and the dismissal's word.

import assert from "node:assert/strict";
import test from "node:test";
import { clearInterference } from "../clear";
import { clearableLayerOverPage } from "../presence";
import { pressWaysOut } from "../press-ways-out";
import { closesOnPress, h, withPage, type FakeElement } from "./fake-layer";

/** The feed's "You're going too fast" notice, before or after its count reaches zero. */
function rateLimitNotice(withOk: boolean, withTryAgain: boolean) {
  const ok = h("div", { role: "button", tabindex: "0" }, "OK");
  const tryAgain = h("div", { role: "button", tabindex: "0", "aria-label": "Try again" }, "Try again");
  const notice = h("div", { role: "alertdialog", "aria-modal": "true" }, [
    h("h2", {}, "You're going too fast"),
    h("div", {}, [
      h("p", {}, "It looks like you were misusing this feature by going too fast. You've been temporarily blocked from using it."),
      h("p", {}, ["You can try again in ", h("span", {}, "0"), " seconds."])
    ]),
    h("div", {}, [...(withOk ? [ok] : []), ...(withTryAgain ? [tryAgain] : [])])
  ]);
  const scrim = h("div", {}, [notice]);
  closesOnPress(ok, scrim);
  closesOnPress(tryAgain, scrim);
  return { scrim, notice, ok, tryAgain };
}

/** The feed's "Turn on notifications?" prompt: a close glyph, Not now, Turn on. */
function notificationPrompt() {
  const close = h("div", { role: "button", tabindex: "0", "aria-label": "Close" }, "✕");
  const notNow = h("div", { role: "button", tabindex: "0" }, "Not now");
  const turnOn = h("div", { role: "button", tabindex: "0" }, "Turn on");
  const prompt = h("div", { role: "dialog", "aria-modal": "true" }, [
    h("div", {}, [h("h2", {}, "Turn on notifications?"), close]),
    h("div", {}, [h("p", {}, "Get notified when friends post, comment or send you a message.")]),
    h("div", {}, [notNow, turnOn])
  ]);
  const scrim = h("div", {}, [prompt]);
  for (const control of [close, notNow, turnOn]) closesOnPress(control, scrim);
  return { scrim, prompt, close, notNow, turnOn };
}

function page(...layers: FakeElement[]): { body: FakeElement; confirm: FakeElement } {
  const confirm = h("div", { role: "button", "aria-label": "Confirm" }, "Confirm");
  return { body: h("body", {}, [h("main", {}, [h("div", { role: "listitem" }, [confirm])]), ...layers]), confirm };
}

test("the rate-limit notice offering OK and Try again is closed by OK alone, and recorded so", () => {
  const notice = rateLimitNotice(true, true);
  const { body, confirm } = page(notice.scrim);
  const cleared = withPage(body, () => pressWaysOut({ element: confirm }));
  assert.deepEqual(cleared, [{ kind: "rate_limit", control: "OK" }]);
  assert.equal(notice.ok.pressed, true);
  assert.deepEqual(notice.tryAgain.events, []);
});

test("Try again is never pressed even when it comes first", () => {
  const ok = h("div", { role: "button" }, "OK");
  const tryAgain = h("div", { role: "button" }, "Try again");
  const notice = h("div", { role: "alertdialog", "aria-modal": "true" }, [h("p", {}, "You're going too fast. You can try again in 0 seconds."), h("div", {}, [tryAgain, ok])]);
  const { body } = page(notice);
  assert.deepEqual(withPage(body, () => pressWaysOut(undefined)), [{ kind: "rate_limit", control: "OK" }]);
  assert.deepEqual(tryAgain.events, []);
});

test("the rate-limit notice offering only Try again is left alone, and is no clearable layer", () => {
  const notice = rateLimitNotice(false, true);
  const { body, confirm } = page(notice.scrim);
  assert.deepEqual(withPage(body, () => pressWaysOut({ element: confirm })), []);
  assert.equal(withPage(body, () => clearableLayerOverPage({ element: confirm })), false);
  assert.deepEqual(notice.tryAgain.events, []);
  assert.equal(withPage(body, () => clearInterference()), 0);
});

test("a prompt in the way of another target is closed by its own way out, and recorded as a dialog", () => {
  const prompt = notificationPrompt();
  const { body, confirm } = page(prompt.scrim);
  assert.deepEqual(withPage(body, () => pressWaysOut({ element: confirm })), [{ kind: "dialog", control: "Close" }]);
  assert.equal(prompt.close.pressed, true);
  assert.deepEqual(prompt.turnOn.events, []);
});

test("a prompt that holds the step's resolved target is kept", () => {
  const prompt = notificationPrompt();
  const { body } = page(prompt.scrim);
  assert.deepEqual(withPage(body, () => pressWaysOut({ element: prompt.notNow })), []);
  assert.equal(withPage(body, () => clearInterference(prompt.turnOn)), 0);
  assert.deepEqual([prompt.close.events, prompt.notNow.events, prompt.turnOn.events], [[], [], []]);
});

test("a prompt is kept when the unresolved target's selector matches inside it", () => {
  const prompt = notificationPrompt();
  const { body } = page(prompt.scrim);
  const target = { selector: '[role="dialog"], [aria-label="Turn on"]' };
  assert.deepEqual(withPage(body, () => pressWaysOut(target)), []);
  assert.equal(withPage(body, () => clearableLayerOverPage(target)), false);
});

test("a prompt is kept when it offers a control by the name the unresolved target was recorded with", () => {
  // Matrix rows 13a/13b: the step's selector matched nothing on the page, so
  // the target was absent, and the clearing closed the prompt it was aimed at.
  const prompt = notificationPrompt();
  const { body } = page(prompt.scrim);
  const target = { selector: '[role="dialog"][data-lb="dlg-t"] > div:last-child > [role="button"]:first-child', names: ["Not now"] };
  assert.deepEqual(withPage(body, () => pressWaysOut(target)), []);
  assert.deepEqual(prompt.notNow.events, []);
});

test("an unresolved target that names nothing in a wall leaves the wall to be cleared", () => {
  const prompt = notificationPrompt();
  const { body } = page(prompt.scrim);
  const target = { selector: '[role="dialog"][data-lb="dlg-t"] > div:last-child', names: ["Friends", "A paragraph of recorded text far longer than any control's own name could be"] };
  assert.equal(withPage(body, () => clearableLayerOverPage(target)), true);
  assert.deepEqual(withPage(body, () => pressWaysOut(target)), [{ kind: "dialog", control: "Close" }]);
});

test("at most three layers are pressed in one intervention", () => {
  const prompts = [notificationPrompt(), notificationPrompt(), notificationPrompt(), notificationPrompt()];
  const { body } = page(...prompts.map((prompt) => prompt.scrim));
  assert.equal(withPage(body, () => pressWaysOut(undefined)).length, 3);
});
