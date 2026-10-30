// A detected list's packet says what kind of value each column holds (CC1),
// which fields are marks and which items carry them (CC2), and which field
// says which item a row is (CC3) -- each only where the domain can tell, and
// none of it where the page proposed none and the capture cannot answer.
//
// The page half -- that detection proposes a badge, a flag and a state as
// marks, and that a mark's column holds a value only on the rows that carry it
// -- is `apps/extension/src/content/extraction/tests/marks.test.ts`. This is
// the domain half: the wire reader keeps `mark`, the packet types the columns
// and lists the marks, the capture gives each item its key and marks, the
// handle keeps `mark` for the page, and `is: "present"` on a mark's key holds
// of exactly the rows that carry it under Core's own condition judge.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { automationStudioRecordConditionHolds } from "fluxiq/automation-studio/nodes";
import { webAutomationExtractListRequestValue } from "../../../../actions/extraction";
import { webAutomationStructureDetectionValue } from "../../../../extraction";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebLlmRepeatingStructure
} from "../..";
import { splitDetectedStructure } from "../packet";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const URL_ = "http://127.0.0.1:4173/scenarios/social-network-feed/";
const CONTAINER = "main > div.feed";
const PRESSED = ':scope > button.like[aria-pressed="true"]';

function field(key: string, label: string, spec: JsonObject, coverage = 1): JsonObject {
  return { key, label, spec: { required: coverage >= 1, ...spec }, coverage };
}

/** What the page proposes for three posts: two carry the badge, one the flag, one is pressed. */
const STRUCTURE = {
  ok: true,
  proposal: {
    container: CONTAINER,
    item: `${CONTAINER} > article.post`,
    itemCount: 3,
    fields: [
      field("promoted", "data-promoted", { kind: "attribute", attribute: "data-promoted", mark: "flag" }, 0.33),
      field("title", "title", { kind: "text", selector: ":scope > a.title" }),
      field("title_url", "a.title url", { kind: "link", selector: ":scope > a.title" }),
      field("price", "price", { kind: "text", selector: ":scope > span.price" }),
      field("posted", "posted", { kind: "text", selector: ":scope > span.posted" }),
      field("reviews", "reviews", { kind: "text", selector: ":scope > span.reviews" }),
      field("verified", "Verified", { kind: "attribute", selector: ":scope > i.badge", attribute: "aria-label", mark: "badge" }, 0.67),
      field("liked", "button.like (pressed)", { kind: "text", selector: PRESSED, mark: "state" }, 0.33)
    ],
    confidence: 0.8
  }
};

type Post = { slug: string; title: string; price: string; posted: string; reviews: string; verified: boolean; promoted: boolean; pressed: boolean };

const POSTS: Post[] = [
  { slug: "p1", title: "Garden notes", price: "$12.50", posted: "21 Sep 2026", reviews: "12 reviews", verified: true, promoted: false, pressed: true },
  { slug: "p2", title: "Rain gauge", price: "$8.00", posted: "3 days ago", reviews: "1 review", verified: false, promoted: true, pressed: false },
  { slug: "p3", title: "Seed swap", price: "$3.25", posted: "Sep 12", reviews: "40 reviews", verified: true, promoted: false, pressed: false }
];

/** The capture: every rendered element of the feed, its parent by index. */
function feedPage(posts: readonly Post[], badges = true): JsonObject[] {
  const elements: JsonObject[] = [];
  const add = (element: JsonObject): number => elements.push(element) - 1;
  const container = add({ tagName: "div", selector: CONTAINER, attributes: { class: "feed" } });
  posts.forEach((post, index) => {
    const item = `${CONTAINER} > article:nth-of-type(${index + 1})`;
    const context = { listPosition: { index: index + 1, total: posts.length } };
    const attributes: JsonObject = { class: "post" };
    if (post.promoted) attributes["data-promoted"] = "";
    const card = add({ tagName: "article", selector: item, attributes, parent: container, context });
    add({ tagName: "a", selector: `${item} > a`, accessibleName: post.title, visibleText: post.title, attributes: { class: "title", href: `/posts/${post.slug}/` }, parent: card, context });
    add({ tagName: "span", selector: `${item} > span:nth-of-type(1)`, visibleText: post.price, attributes: { class: "price" }, parent: card, context });
    add({ tagName: "span", selector: `${item} > span:nth-of-type(2)`, visibleText: post.posted, attributes: { class: "posted" }, parent: card, context });
    add({ tagName: "span", selector: `${item} > span:nth-of-type(3)`, visibleText: post.reviews, attributes: { class: "reviews" }, parent: card, context });
    if (post.verified && badges) add({ tagName: "i", selector: `${item} > i`, role: "img", accessibleName: "Verified", attributes: { class: "badge", role: "img", "aria-label": "Verified" }, parent: card, context });
    add({ tagName: "button", selector: `${item} > button`, accessibleName: "Like", visibleText: "Like", attributes: { class: "like", "aria-pressed": post.pressed ? "true" : "false" }, parent: card, context });
  });
  return elements;
}

async function detected(structure: JsonObject = STRUCTURE, page: JsonObject[] = feedPage(POSTS)): Promise<WebLlmRepeatingStructure> {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: URL_, title: "Feed", interactiveElements: page };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(structure) as JsonValue } };
    }
  });
  const result = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  return result.evidence as WebLlmRepeatingStructure;
}

function column(packet: WebLlmRepeatingStructure, key: string) {
  const found = packet.fields.find((each) => each.key === key);
  assert.ok(found, `the packet lists ${key}`);
  return found;
}

test("each column says what kind of value it holds, and its sample read as that kind where that does not depend on the day", async () => {
  const packet = await detected();
  assert.deepEqual([column(packet, "price").type, column(packet, "price").parsed], ["currency", 12.5]);
  assert.deepEqual([column(packet, "posted").type, column(packet, "posted").parsed], ["date", "2026-09-21"]);
  assert.deepEqual([column(packet, "reviews").type, column(packet, "reviews").parsed], ["count", 12]);
  assert.deepEqual([column(packet, "title").type, column(packet, "title").parsed], ["text", undefined]);
  assert.equal(column(packet, "title_url").type, "url");
  for (const mark of ["promoted", "verified", "liked"]) assert.equal(column(packet, mark).type, "flag", `${mark} is a mark`);
});

test("the packet names the page's marks by key, and gives each item its key and marks off the capture", async () => {
  const packet = await detected();
  assert.deepEqual(packet.fieldMarks?.map((mark) => [mark.id, mark.kind]), [["promoted", "flag"], ["verified", "badge"], ["liked", "state"]]);
  assert.equal(packet.fieldMarks?.find((mark) => mark.id === "verified")?.label, "Verified");
  assert.equal(typeof packet.markNote, "string");
  assert.deepEqual(packet.rowIdentity, ["title_url"]);
  assert.deepEqual(packet.items, [
    { itemKey: "/posts/p1/", marks: { promoted: "off", verified: "on", liked: "on" } },
    { itemKey: "/posts/p2/", marks: { promoted: "on", verified: "off", liked: "off" } },
    { itemKey: "/posts/p3/", marks: { promoted: "off", verified: "on", liked: "off" } }
  ]);
  assert.equal(typeof packet.itemsNote, "string");
  assert.equal(JSON.stringify(packet).includes("aria-pressed"), false, "no selector or attribute read is quoted");
});

test("a mark the capture cannot see on the items the page counted is left out of every item, never said off", async () => {
  const packet = await detected(STRUCTURE, feedPage(POSTS, false));
  assert.equal(packet.fieldMarks?.some((mark) => mark.id === "verified"), true, "the page still proposed it");
  for (const item of packet.items ?? []) assert.equal(Object.hasOwn(item.marks ?? {}, "verified"), false);
  assert.deepEqual(packet.items?.map((item) => item.marks?.liked), ["on", "off", "off"]);
});

test("no row identity where two items share the value, and nothing new where the page proposed no mark and nothing was captured", async () => {
  const twins = POSTS.map((post) => ({ ...post, slug: "same" }));
  const shared = await detected(STRUCTURE, feedPage(twins));
  assert.equal(shared.rowIdentity, undefined);
  assert.deepEqual(shared.items?.map((item) => item.itemKey), [undefined, undefined, undefined]);

  const plain = webAutomationStructureDetectionValue({ ok: true, proposal: { ...STRUCTURE.proposal, fields: STRUCTURE.proposal.fields.filter((each) => (each.spec as JsonObject).mark === undefined) } });
  assert.ok(plain?.ok);
  const split = splitDetectedStructure({ detection: plain, handle: "extraction.1", recordHandle: undefined, location: URL_, target: undefined, frameId: undefined, frameUrlPath: undefined, firstItem: undefined });
  assert.ok(split);
  for (const key of ["fieldMarks", "markNote", "rowIdentity", "items", "itemsNote"]) assert.equal(Object.hasOwn(split.packet, key), false, `${key} is absent`);
});

test("the handle keeps each mark for the page, and is: present on a mark's key keeps exactly the rows that carry it", async () => {
  const detection = webAutomationStructureDetectionValue(structuredClone(STRUCTURE));
  assert.ok(detection?.ok, "the wire reader keeps a proposal with marks");
  const split = splitDetectedStructure({ detection, handle: "extraction.1", recordHandle: undefined, location: URL_, target: undefined, frameId: undefined, frameUrlPath: undefined, firstItem: undefined });
  assert.ok(split);
  assert.deepEqual(split.binding.extractList.fields.liked, { kind: "text", selector: PRESSED, required: false, mark: "state" });
  assert.equal((split.binding.extractList.fields.promoted as JsonObject).mark, "flag");
  const request = webAutomationExtractListRequestValue({ ...split.binding.extractList, where: [{ field: "liked", is: "present" }] });
  assert.ok(request);
  const [condition] = request.where ?? [];
  // The stored rows as the page reads them: a value only on the pressed post (`item-mark/`).
  const stored = ["Like", null, null];
  assert.deepEqual(stored.map((cell) => automationStudioRecordConditionHolds(condition!, cell)), [true, false, false]);
});

test("the request reader keeps a mark on a kind that reads it, leaves it behind on another, and refuses one it does not know", () => {
  const read = (spec: JsonObject) => webAutomationExtractListRequestValue({ item: "li", fields: { mark: spec } })?.fields.mark;
  assert.deepEqual(read({ kind: "attribute", attribute: "data-new", mark: "flag" }), { kind: "attribute", attribute: "data-new", mark: "flag" });
  assert.deepEqual(read({ kind: "text", selector: "b", mark: "flag" }), { kind: "text", selector: "b" });
  assert.deepEqual(read({ kind: "link", selector: "a", mark: "state" }), { kind: "link", selector: "a" });
  assert.equal(read({ kind: "attribute", attribute: "data-new", mark: "maybe" }), undefined);
});
