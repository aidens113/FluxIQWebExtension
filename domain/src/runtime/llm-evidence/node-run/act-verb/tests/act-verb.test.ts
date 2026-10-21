// The verb a node's act is put to the person and to Core's site-reset ledger in.
//
// The check node's label is "Set Checked" whichever way it goes, so an untick
// was told to the person, and recorded for the reset, as "set checked" -- and
// read back as the control having been switched on (t753). The check node now
// says which way it goes; every other node keeps its label.

import assert from "node:assert/strict";
import test from "node:test";
import { webRunnableNode } from "../../catalog";
import { webNodeActVerb } from "..";

const CHECK = "web.output.dom-check";
const CLICK = "web.output.dom-click";
const NAVIGATE = "web.output.browser-navigate";

function node(id: string) {
  const found = webRunnableNode(id);
  assert.ok(found, `${id} is runnable here`);
  return found;
}

test("a check asked to clear its control is an untick", () => {
  assert.equal(webNodeActVerb(node(CHECK), { selector: "#gift", checked: false }), "untick");
});

test("a check asked to set its control is a tick, and so is one that names no state, as the command defaults", () => {
  assert.equal(webNodeActVerb(node(CHECK), { selector: "#gift", checked: true }), "tick");
  assert.equal(webNodeActVerb(node(CHECK), { selector: "#gift" }), "tick");
  assert.equal(webNodeActVerb(node(CHECK), undefined), "tick");
});

test("every other node keeps its label as its verb, whatever it carries", () => {
  for (const id of [CLICK, NAVIGATE]) {
    const other = node(id);
    assert.equal(webNodeActVerb(other, { checked: false }), other.definition.label.toLowerCase());
  }
});
