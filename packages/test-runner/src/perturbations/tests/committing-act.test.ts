import assert from "node:assert/strict";
import test from "node:test";
import { isCommittingAct } from "../committing-act.js";

test("presses, key presses, dialog answers and submitting typing commit; nothing else does", () => {
  assert.equal(isCommittingAct("web.dom.click", { selector: "#confirm" }), true);
  assert.equal(isCommittingAct("web.dom.keypress", { key: "Enter" }), true);
  assert.equal(isCommittingAct("web.dom.dialog", { accept: true }), true);
  assert.equal(isCommittingAct("web.dom.type", { selector: "#q", text: "x", submit: true }), true);
  assert.equal(isCommittingAct("web.dom.type", { selector: "#q", text: "x" }), false);
  assert.equal(isCommittingAct("web.dom.extract", { selector: "html" }), false);
  assert.equal(isCommittingAct("web.browser.navigate", { url: "http://127.0.0.1/" }), false);
  assert.equal(isCommittingAct("web.dom.click", null), true);
});
