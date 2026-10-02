// T1 coverage of the structure-detection wire pair: the request the authoring
// runtime sends and the detection the page answers. The copy admits a
// well-formed detection field by field and nothing else, and refuses whole what
// a request reader would refuse, so an extraction handle can never stand for a
// request the page would not run. Real detections are round-tripped in
// `runtime/llm-evidence/structure/tests/detect.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import {
  webAutomationSectionLinkLabel,
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
  // A member the field's kind does not take is dropped too (t194-w45).
  noisy.proposal.fields[0].spec.attribute = "href";
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
  for (const value of [undefined, null, [], "#list", { selector: "" }, { selector: "   " }, { selector: 3 }, { selector: "#a", frame: 1 }, { target: "t1" }]) {
    assert.equal(webAutomationStructureDetectionRequestValue(value), undefined, JSON.stringify(value));
  }
});

// The one record around the request's element, sent beside the run when the
// element sits outside every item of it: the photo-social reply card beside
// the inbox's thread rows (moon-jar audit cause 1).

function replyCard(): Record<string, any> {
  return {
    container: "section.conversation > div > a.card2",
    item: "section.conversation > div > a.card2 > div",
    itemCount: 1,
    fields: [
      { key: "span", label: "span", spec: { kind: "text", selector: ":scope > span", required: true }, coverage: 1 },
      { key: "span_2", label: "span (currency amount)", spec: { kind: "text", selector: ":scope > span:nth-of-type(2)", required: true }, coverage: 1 },
      { key: "span_meta", label: "span.meta", spec: { kind: "text", selector: ":scope > span.meta", required: true }, coverage: 1 }
    ],
    confidence: 0.38
  };
}

test("a record beside the run is copied with it, field by field, and leaves its page text behind", () => {
  const withRecord = { ...detection(), record: replyCard() };
  assert.deepEqual(webAutomationStructureDetectionValue(withRecord), withRecord);
  const feed: Record<string, any> = { ...detection(), infiniteScroll: true, record: replyCard() };
  delete feed.proposal.pagination;
  assert.deepEqual(webAutomationStructureDetectionValue(feed), feed);
  const noisy = { ...detection(), record: { ...replyCard(), sample: "€68.00" } };
  const copied = webAutomationStructureDetectionValue(noisy);
  assert.deepEqual(copied, { ...detection(), record: replyCard() });
  assert.equal(JSON.stringify(copied).includes("€68.00"), false);
});

test("a record that is several items, or not a well-formed proposal, refuses the detection whole", () => {
  const broken: Array<[string, (record: Record<string, any>) => void]> = [
    ["a record of three items", (record) => { record.itemCount = 3; }],
    ["a record of none", (record) => { record.itemCount = 0; }],
    ["a record with no fields", (record) => { record.fields = []; }],
    ["a record with no container", (record) => { record.container = ""; }],
    ["a record with an element fingerprint", (record) => { record.fields[0].spec.element = { tagName: "span", text: "€68.00" }; }]
  ];
  for (const [why, damage] of broken) {
    const record = replyCard();
    damage(record);
    assert.equal(webAutomationStructureDetectionValue({ ...detection(), record }), undefined, why);
  }
  assert.equal(webAutomationStructureDetectionValue({ ...detection(), record: "the card" }), undefined, "a record that is not an object");
});

// The run's own section linking to more of it (t195 w22e): Circleway's Friends
// home shows four of eight requests under a header whose "See all" opens the
// rest (live run 36, cause 11). The label is one of a closed set of phrases,
// so no page value crosses, and a link's path is a bounded same-origin path.

test("a section link beside the run is copied with its closed-phrase label and its path, and nothing else", () => {
  const withLink = { ...detection(), continues: { label: "See all", path: "/circleway/friends/requests/" } };
  assert.deepEqual(webAutomationStructureDetectionValue(withLink), withLink);
  const button = { ...detection(), continues: { label: "Show more" } };
  assert.deepEqual(webAutomationStructureDetectionValue(button), button);
  const noisy = { ...detection(), continues: { label: "View all ›", path: "/orders", sample: "Ada Lovelace" } };
  const copied = webAutomationStructureDetectionValue(noisy);
  assert.deepEqual(copied, { ...detection(), continues: { label: "View all ›", path: "/orders" } });
  assert.equal(JSON.stringify(copied).includes("Ada Lovelace"), false);
});

test("a section link whose label is not wholly a closed phrase, or whose path is not a bounded path, refuses the detection whole", () => {
  const broken: unknown[] = [
    "See all",
    { path: "/friends/requests/" },
    { label: "See all 8 requests" },
    { label: "Ada Lovelace" },
    { label: " See all" },
    { label: "see  all" },
    { label: "See all" + " ›".repeat(12) },
    { label: 7 },
    { label: "See all", path: "friends/requests/" },
    { label: "See all", path: "https://elsewhere.test/requests" },
    { label: "See all", path: "/friends requests/" },
    { label: "See all", path: `/${"a".repeat(300)}` },
    { label: "See all", path: 3 }
  ];
  for (const continues of broken) {
    assert.equal(webAutomationStructureDetectionValue({ ...detection(), continues }), undefined, JSON.stringify(continues));
  }
});

test("the closed phrases are see, view or show, then all or more, whole, with nothing after but an arrow", () => {
  for (const label of ["See all", "see all", "View all", "Show all", "See more", "View more", "Show more", "See all ›", "View all →", " See \n all "]) {
    assert.ok(webAutomationSectionLinkLabel(label) !== undefined, label);
  }
  assert.equal(webAutomationSectionLinkLabel(" See \n all "), "See all");
  for (const label of ["", "All", "See", "See all 8", "See all requests", "Show more like this", "Load more", "View sent requests", "More"]) {
    assert.equal(webAutomationSectionLinkLabel(label), undefined, label);
  }
});
