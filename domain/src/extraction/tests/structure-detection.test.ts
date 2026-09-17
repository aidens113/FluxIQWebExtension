// T1 coverage of the structure-detection wire pair: the request the authoring
// runtime sends and the detection the page answers. The copy admits a
// well-formed detection field by field and nothing else, and refuses whole what
// a request reader would refuse, so an extraction handle can never stand for a
// request the page would not run. Real detections are round-tripped in
// `runtime/llm-evidence/structure/tests/detect.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import {
  webAutomationStructureDetectionRequestValue,
  webAutomationStructureDetectionValue,
  WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS
} from "../structure-detection";

function detection(): Record<string, any> {
  return {
    ok: true,
    proposal: {
      container: "#list",
      item: "#list > li",
      itemCount: 3,
      fields: [
        { key: "name", label: "name", spec: { kind: "text", selector: ".name", required: true }, coverage: 1 },
        { key: "link", label: "link", spec: { kind: "link", selector: "a", required: false }, coverage: 0.67 },
        { key: "secret", label: "secret", spec: { kind: "value", selector: "input", handling: "exclude", required: true }, coverage: 1 }
      ],
      pagination: { next: "a[rel=next]", maxPages: 4 },
      confidence: 0.9
    }
  };
}

test("a well-formed detection is copied exactly, and a refusal is copied by its word alone", () => {
  assert.deepEqual(webAutomationStructureDetectionValue(detection()), detection());
  const feed = { ...detection(), infiniteScroll: true, proposal: { ...detection().proposal, pagination: undefined } };
  delete feed.proposal.pagination;
  assert.deepEqual(webAutomationStructureDetectionValue(feed), feed);
  for (const refused of WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS) {
    assert.deepEqual(webAutomationStructureDetectionValue({ ok: false, refused, detail: "page text" }), { ok: false, refused });
  }
  assert.deepEqual([...WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS], ["target_not_found", "ambiguous_target", "no_repeating_run", "sensitive_region"]);
});

test("whatever a producer put beside the declared fields is left behind", () => {
  const noisy = detection();
  noisy.sample = "a page value";
  noisy.proposal.sample = "a page value";
  noisy.proposal.fields[0].sample = "a page value";
  noisy.proposal.fields[0].spec.sample = "a page value";
  noisy.proposal.pagination.sample = "a page value";
  const copied = webAutomationStructureDetectionValue(noisy);
  assert.deepEqual(copied, detection());
  assert.equal(JSON.stringify(copied).includes("a page value"), false);
});

test("a detection any part of which is malformed is refused whole", () => {
  const broken: Array<[string, (value: Record<string, any>) => void]> = [
    ["an unknown refusal", (value) => Object.assign(value, { ok: false, refused: "because" })],
    ["no ok flag", (value) => { delete value.ok; }],
    ["a false infinite-scroll flag", (value) => { value.infiniteScroll = false; }],
    ["no proposal", (value) => { delete value.proposal; }],
    ["an empty container", (value) => { value.proposal.container = ""; }],
    ["no item", (value) => { delete value.proposal.item; }],
    ["a negative count", (value) => { value.proposal.itemCount = -1; }],
    ["a fractional count", (value) => { value.proposal.itemCount = 2.5; }],
    ["a confidence above one", (value) => { value.proposal.confidence = 1.2; }],
    ["no fields", (value) => { value.proposal.fields = []; }],
    ["a coverage above one", (value) => { value.proposal.fields[0].coverage = 1.5; }],
    ["a label that is not text", (value) => { value.proposal.fields[0].label = 7; }],
    ["a malformed key", (value) => { value.proposal.fields[0].key = "has space"; }],
    ["a prototype key", (value) => { value.proposal.fields[0].key = "__proto__"; }],
    ["a repeated key", (value) => { value.proposal.fields[1].key = "name"; }],
    ["an element fingerprint, which holds page values", (value) => { value.proposal.fields[0].spec.element = { tagName: "span", text: "Ada" }; }],
    ["an unknown kind", (value) => { value.proposal.fields[0].spec.kind = "html"; }],
    ["an attribute on a text field", (value) => { value.proposal.fields[0].spec.attribute = "href"; }],
    ["an unknown pagination mode", (value) => { value.proposal.pagination = { mode: "teleport", maxPages: 2 }; }],
    ["a pagination with no bound", (value) => { value.proposal.pagination = { next: "a" }; }],
    ["every field excluded", (value) => { for (const field of value.proposal.fields) field.spec.handling = "exclude"; }]
  ];
  for (const [why, damage] of broken) {
    const value = detection();
    damage(value);
    assert.equal(webAutomationStructureDetectionValue(value), undefined, why);
  }
  for (const value of [undefined, null, "ok", [], 1]) assert.equal(webAutomationStructureDetectionValue(value), undefined);
});

test("the request is empty or names one selector, and nothing else", () => {
  assert.deepEqual(webAutomationStructureDetectionRequestValue({}), {});
  assert.deepEqual(webAutomationStructureDetectionRequestValue({ selector: "#list li" }), { selector: "#list li" });
  for (const value of [undefined, null, [], "#list", { selector: "" }, { selector: "   " }, { selector: 3 }, { selector: "#a", frame: 1 }, { target: "target.1" }]) {
    assert.equal(webAutomationStructureDetectionRequestValue(value), undefined, JSON.stringify(value));
  }
});
