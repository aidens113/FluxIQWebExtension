import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { collectWebLlmControlIntents } from "..";

function capture() {
  return sanitizeWebLlmSnapshotWithBindings({ url: "https://example.test/", interactiveElements: [
    { tagName: "div", selector: "#consent", role: "dialog", bounds: { x: 0, y: 0, width: 300, height: 300 } },
    { tagName: "button", selector: "#accept", accessibleName: "Accept all", parent: 0, bounds: { x: 20, y: 20, width: 80, height: 20 } },
    { tagName: "span", selector: "#glyph", visibleText: "×", parent: 1 },
    { tagName: "button", selector: "#buy", accessibleName: "Buy now" },
    { tagName: "a", selector: "#help", accessibleName: "Help", href: "/help" }
  ], evidence: { dialogs: { open: [{ selector: "#consent", modal: true, kind: "consent", bounds: { x: 0, y: 0, width: 300, height: 300 } }] } } });
}

test("captures sanitized modal membership independently of ancestry", () => {
  const binding = capture();
  delete binding.evidence.elements[1]!.parent;
  assert.equal(binding.evidence.elements[1]!.inDialog, "t1");
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t2"), { intent: "accept", responseOnly: true });
});

test("a close glyph inside an acting button keeps that button's actual meaning", () => {
  const binding = capture();
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t3"), { intent: "accept", responseOnly: true });
  binding.evidence.elements[1]!.name = "Join now";
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t3"), { intent: "accept" });
  binding.evidence.elements[2]!.role = "button";
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t3"), { intent: "accept" });
});

test("coverage, labels, saved context, wrong frames, unknown layers and invalid ancestry give no response-only bit", () => {
  const cases = [
    (b: ReturnType<typeof capture>) => { b.evidence.elements[1]!.coveredBy = ["t1"]; },
    (b: ReturnType<typeof capture>) => { b.evidence.elements[1]!.frameId = 2; },
    (b: ReturnType<typeof capture>) => { b.evidence.elements[0]!.isDialog = { modal: true, kind: "promotion" }; },
    (b: ReturnType<typeof capture>) => {
      delete b.evidence.elements[0]!.isDialog;
      b.dialogNames?.set("t2", "consent");
    },
    (b: ReturnType<typeof capture>) => { b.evidence.elements[1]!.parent = "t2"; },
    (b: ReturnType<typeof capture>) => { b.evidence.elements[1]!.parent = "missing"; },
    (b: ReturnType<typeof capture>) => { b.evidence.elements[0]!.parent = "t2"; },
    (b: ReturnType<typeof capture>) => { b.evidence.elements[0]!.hidden = true; }
  ];
  for (const alter of cases) {
    const binding = capture();
    alter(binding);
    assert.deepEqual(collectWebLlmControlIntents(binding).get("t2"), { intent: "accept" });
  }
});

test("parent membership in an actual consent cover is positive, coveredBy alone is not", () => {
  const binding = capture();
  const layer = binding.evidence.elements[0]!;
  delete layer.isDialog;
  layer.kind = "consent";
  layer.covers = ["t4"];
  delete binding.evidence.elements[1]!.inDialog;
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t2"), { intent: "accept", responseOnly: true });
  binding.evidence.elements[3]!.name = "Accept all";
  binding.evidence.elements[3]!.coveredBy = ["t1"];
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t4"), { intent: "accept" });
});

test("a different inner layer never borrows outer consent and container prose is not a control", () => {
  const binding = capture();
  binding.evidence.elements[1]!.kind = "promotion";
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t2"), { intent: "accept" });
  binding.evidence.elements[0]!.name = "Accept cookies";
  assert.deepEqual(collectWebLlmControlIntents(binding).get("t1"), { intent: "neutral" });
});

test("results copy and freeze meanings and contain only actual retained handles", () => {
  const binding = capture();
  const result = collectWebLlmControlIntents(binding);
  binding.evidence.elements[1]!.name = "Buy now";
  assert.deepEqual(result.get("t2"), { intent: "accept", responseOnly: true });
  assert.equal(Object.isFrozen(result.get("t2")), true);
  assert.deepEqual(result.get("t5"), { intent: "navigate" });
  binding.selectors.delete("t4");
  binding.selectors.set("made-up", "#none");
  assert.deepEqual([...collectWebLlmControlIntents(binding).keys()], ["t1", "t2", "t3", "t5"]);
});
