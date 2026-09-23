// A campaign row has to say what a build's steps declared they would lastingly
// do and who allowed it, because that is the difference between a result about
// the product and a result about the harness.

import assert from "node:assert/strict";
import test from "node:test";
import { consequenceSummary } from "../consequences.mjs";

const press = (consequences, permitted, extra = {}) => ({
  actionKind: "flow_step", actionId: "web.output.dom-click", ref: "main.s6", verb: "press",
  controlName: "Schedule post", controlKind: "button", consequences, permitted, ...extra,
});
const read = { actionKind: "exploration_step", actionId: "web.output.dom-type", ref: "call-2", verb: "enter", controlName: "Post text", controlKind: "textbox", consequences: [], permitted: true };

const snapshot = (build, granted = []) => ({ granted: { permittedConsequences: granted }, build });

test("a run that made no build has nothing to say about consequences", () => {
  assert.equal(consequenceSummary(null), null);
  assert.equal(consequenceSummary({ observed: { calls: 3 } }), null);
});

test("a build Core kept no declarations for reads as not recorded, never as a build that declared nothing", () => {
  const summary = consequenceSummary(snapshot({ outcome: "proposed", declaredConsequences: null }));

  assert.equal(summary.answeredBy, "not recorded");
  assert.equal(summary.actions, null);
  assert.equal(summary.declaredNothing, null);
});

test("a build whose every action declared nothing lasting had nothing to permit", () => {
  const summary = consequenceSummary(snapshot({ outcome: "proposed", declaredConsequences: [read, read] }));

  assert.equal(summary.answeredBy, "nothing lasting");
  assert.deepEqual([summary.actions, summary.declaredNothing], [2, 2]);
  assert.deepEqual(summary.declared, []);
  assert.deepEqual(summary.lastingActions, []);
});

test("a class the person's own instruction asks for was allowed by the instruction, with no grant involved", () => {
  const summary = consequenceSummary(snapshot({
    outcome: "proposed",
    declaredConsequences: [read, press(["send_or_publish"], true)],
    instructedConsequences: [{ consequence: "send_or_publish", quote: "Schedule a post" }],
  }));

  assert.equal(summary.answeredBy, "instruction");
  assert.deepEqual(summary.declared, ["send_or_publish"]);
  assert.deepEqual(summary.lastingActions, [{ actionKind: "flow_step", verb: "press", consequences: ["send_or_publish"], permitted: true }]);
  assert.deepEqual([summary.actions, summary.declaredNothing], [2, 1]);
});

test("a class only the task's own permits covered was allowed by the campaign, which is the reading that has to stay apart", () => {
  const summary = consequenceSummary(snapshot({
    outcome: "proposed",
    declaredConsequences: [press(["move_money"], true)],
    instructedConsequences: [],
  }, ["move_money"]));

  assert.equal(summary.answeredBy, "campaign");
  assert.deepEqual(summary.granted, ["move_money"]);
});

test("a build that asked and was not answered says so, and names what it lacked", () => {
  const summary = consequenceSummary(snapshot({
    outcome: "permission_required",
    declaredConsequences: [read, press(["send_or_publish"], false, { missing: ["send_or_publish"] })],
    instructedConsequences: [],
    permissionRequest: { actionKind: "flow_step", verb: "press", controlName: "Schedule post", controlKind: "button", consequences: ["send_or_publish"], missing: ["send_or_publish"], instructed: [] },
  }));

  assert.equal(summary.answeredBy, "nobody");
  assert.deepEqual(summary.permissionRequest, { verb: "press", controlKind: "button", consequences: ["send_or_publish"], missing: ["send_or_publish"] });
});

test("the cross-check's finding travels, because a class the instruction asks for and nothing declared is what nothing else catches", () => {
  const summary = consequenceSummary(snapshot({
    outcome: "proposed",
    declaredConsequences: [press(["send_or_publish"], true)],
    instructedConsequences: [{ consequence: "send_or_publish", quote: "Schedule a post" }, { consequence: "create_new", quote: "Schedule a post" }],
    consequenceCrossCheck: { verdict: "undeclared", declared: ["send_or_publish"], instructed: ["send_or_publish", "create_new"], undeclared: ["create_new"], beyondInstruction: [], actions: 1, declaredNothing: 0 },
  }));

  assert.equal(summary.crossCheckVerdict, "undeclared");
  assert.deepEqual(summary.crossCheckUndeclared, ["create_new"]);
});

test("nothing free-text reaches the row: a control kind or verb that is not a closed word is withheld", () => {
  const summary = consequenceSummary(snapshot({
    outcome: "permission_required",
    declaredConsequences: [press(["send_or_publish"], false)],
    permissionRequest: { verb: "Press the button labelled 'Schedule post for @northwind'", controlKind: "button", consequences: ["send_or_publish", "Schedule post"], missing: ["send_or_publish"] },
  }));

  assert.equal(summary.permissionRequest.verb, null);
  assert.deepEqual(summary.permissionRequest.consequences, ["send_or_publish"]);
});
