// Where a dialog view's control sits (`../control-places.ts`, t781): a toggle's two states share both places; another
// kind of control, another context or another address does not share the exact one; positions and shadow hosts
// moving leave the loose one alone.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebPlanElementIdentity } from "../../element-identity";
import { webLlmDialogControlPlaces } from "..";

const DIALOG = "Post by kiln.theory";
const LIKE = "body > div:nth-of-type(2) > article > section > div:nth-of-type(1)";
const button = (name: string, extra: Partial<WebPlanElementIdentity> = {}): WebPlanElementIdentity => ({ tagName: "div", role: "button", accessibleName: name, visibleText: name, context: { dialog: DIALOG }, ...extra });
const places = (element: WebPlanElementIdentity, selector = LIKE, frameId?: number) => webLlmDialogControlPlaces({ selector, frameId, element });

test("a toggle's two states sit at one place: its words are its state, not its place", () => {
  assert.deepEqual(places(button("Unlike", { attributes: { "aria-pressed": "true" } })), places(button("Like")));
});

test("a record's words, which hold the count beside the toggle, are no part of its place; its key is", () => {
  const inRecord = (text: string) => button("Like", { context: { dialog: DIALOG, record: { keyAttribute: "data-id", key: "kiln-1", text } } });
  assert.deepEqual(places(inRecord("kiln.theory 13 likes")), places(inRecord("kiln.theory 12 likes")));
});

test("another tag, role, dialog, record, frame or address is another exact place", () => {
  const like = places(button("Like")).exact;
  assert.notEqual(places(button("Like", { tagName: "a" })).exact, like);
  assert.notEqual(places(button("Like", { role: "link" })).exact, like);
  assert.notEqual(places(button("Like", { context: { dialog: "Another" } })).exact, like);
  assert.notEqual(places(button("Like", { context: { dialog: DIALOG, record: { key: "row" } } })).exact, like);
  assert.notEqual(places(button("Like"), LIKE, 3).exact, like);
  assert.notEqual(places(button("Like"), LIKE.replace("div:nth-of-type(1)", "div:nth-of-type(2)")).exact, like);
});

test("a layer that shifts positions, inside or above a shadow root, moves the exact place and leaves the loose one", () => {
  const inRoot = (host: string, selector: string) => places(button("Like", { context: { dialog: DIALOG, shadowHosts: [host] } }), selector);
  const before = inRoot("body > div:nth-of-type(2) > photo-dialog", LIKE);
  const after = inRoot("body > div:nth-of-type(3) > photo-dialog", LIKE.replace("div:nth-of-type(2)", "div:nth-of-type(3)"));
  assert.notEqual(after.exact, before.exact);
  assert.equal(after.loose, before.loose);
});
