// The host chain a command carries, read the way `resolve-target.ts` reads it.
//
// These rows exist because two readers of one wire field must agree. The
// resolver looks for the element in the roots the chain reaches; the wait now
// looks for the same element in the same roots. If the two disagreed about
// *which* description carries the chain, a Flow would wait in one place and
// click in another, and the wait would be exactly the false negative it was
// added to remove.
//
// The rule, from `recordedTarget` (`resolve-target.ts`): the first description
// that describes anything decides, `element` before `options.element`, and a
// description that names no chain is a target in the light document rather
// than a reason to read the description beside it.

import assert from "node:assert/strict";
import test from "node:test";
import { recordedShadowHosts } from "../recorded-shadow-hosts";
import type { BrowserActionCommand } from "../../types";

const HOSTS = ["body > rf-consent"];
const OTHER = ["body > div:nth-of-type(7)", "chat-card"];

function command(fields: Partial<BrowserActionCommand>): BrowserActionCommand {
  return { commandId: "c", actionType: "web.dom.wait_for_selector", ...fields } as BrowserActionCommand;
}

test("the chain is read off the declared element", () => {
  assert.deepEqual(recordedShadowHosts(command({ element: { selector: "button", context: { shadowHosts: HOSTS } } })), HOSTS);
});

test("and off the untyped options bag the same description travels in", () => {
  assert.deepEqual(recordedShadowHosts(command({ options: { element: { selector: "button", context: { shadowHosts: HOSTS } } } })), HOSTS);
});

test("the declared element decides, and its silence about a chain is an answer", () => {
  const action = command({
    element: { selector: "button", tagName: "button" },
    options: { element: { selector: "button", context: { shadowHosts: OTHER } } }
  });
  assert.equal(recordedShadowHosts(action), undefined, "a target described in the light document is not scoped to another target's roots");
});

test("an element that describes nothing at all is skipped, as the resolver skips it", () => {
  const action = command({
    element: {},
    options: { element: { selector: "button", context: { shadowHosts: HOSTS } } }
  });
  assert.deepEqual(recordedShadowHosts(action), HOSTS);
});

test("a command with no recorded target names no roots", () => {
  assert.equal(recordedShadowHosts(command({ selector: "#accept" })), undefined);
});

test("a chain that is not a list of host selectors is no chain", () => {
  const rows: unknown[] = ["body > rf-consent", [], [""], [1], ["a", 2], {}, null];
  for (const shadowHosts of rows) {
    const action = command({ element: { selector: "button", context: { shadowHosts } } as BrowserActionCommand["element"] });
    assert.equal(recordedShadowHosts(action), undefined, `a wait must not be scoped by ${JSON.stringify(shadowHosts)}`);
  }
});
