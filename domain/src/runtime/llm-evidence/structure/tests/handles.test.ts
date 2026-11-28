// Which list a binding names, by the site's structure alone (invariant I3): the item selector, the
// container and the frame. A cinema's seat map is read, redrawn between two detections, and read again.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListAnswered } from "../../../../output-nodes";
import { createWebLlmExtractionHandles, webLlmExtractionListKey, type WebLlmExtractionBindingRetained } from "../handles";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const SEATS = "main > section.seat-map > div.seat";
const SHOWINGS = "main > table.timetable > tbody > tr";

function binding(handle: string, item: string, extra: Partial<WebLlmExtractionBindingRetained> = {}): WebLlmExtractionBindingRetained {
  return { handle, location: "https://cinema.test/screens/3", extractList: { item, fields: { seat: { kind: "text", selector: ":scope > span.label" } } }, itemCount: 12, ...extra };
}

function keyOf(handles: ReturnType<typeof createWebLlmExtractionHandles>, handle: string): string | undefined {
  const resolved = handles.resolve(SCOPE, handle);
  return resolved.ok ? resolved.binding.listKey : undefined;
}

test("two detections of one redrawn list give one key, under two handles and two item counts", () => {
  const handles = createWebLlmExtractionHandles();
  const first = handles.reserve();
  handles.retain(SCOPE, binding(first, SEATS, { container: "main > section.seat-map", itemCount: 12 }));
  const second = handles.reserve();
  handles.retain(SCOPE, binding(second, SEATS, { container: "main > section.seat-map", itemCount: 9, location: "https://cinema.test/screens/3?showing=2" }));
  assert.notEqual(first, second);
  assert.match(String(keyOf(handles, first)), /^list\.[0-9a-f]{28}$/u);
  assert.equal(keyOf(handles, first), keyOf(handles, second));
});

test("two different lists give two keys", () => {
  const handles = createWebLlmExtractionHandles();
  const seats = handles.reserve();
  handles.retain(SCOPE, binding(seats, SEATS));
  const showings = handles.reserve();
  handles.retain(SCOPE, binding(showings, SHOWINGS));
  assert.notEqual(keyOf(handles, seats), keyOf(handles, showings));
  // The same item in another container is another list.
  assert.notEqual(webLlmExtractionListKey(binding("extraction.1", SEATS, { container: "aside.left" })), webLlmExtractionListKey(binding("extraction.1", SEATS, { container: "aside.right" })));
});

test("a frame path changes the key, and a frame renumbered by a reload does not when its path is known", () => {
  const top = webLlmExtractionListKey(binding("extraction.1", SEATS));
  const inFrame = webLlmExtractionListKey(binding("extraction.1", SEATS, { frameId: 4, frameUrlPath: "/embed/seats" }));
  const otherFrame = webLlmExtractionListKey(binding("extraction.1", SEATS, { frameId: 4, frameUrlPath: "/embed/times" }));
  const renumbered = webLlmExtractionListKey(binding("extraction.1", SEATS, { frameId: 9, frameUrlPath: "/embed/seats" }));
  assert.notEqual(top, inFrame);
  assert.notEqual(inFrame, otherFrame);
  assert.equal(inFrame, renumbered);
});

test("a binding that was given a key keeps it", () => {
  const handles = createWebLlmExtractionHandles();
  const kept = handles.reserve();
  handles.retain(SCOPE, binding(kept, SEATS, { listKey: "list.given" }));
  assert.equal(keyOf(handles, kept), "list.given");
});

test("a saved read of the list, which has no handle, answers with the key its detection was given", () => {
  const handles = createWebLlmExtractionHandles();
  const seats = handles.reserve();
  handles.retain(SCOPE, binding(seats, SEATS, { frameId: 4, frameUrlPath: "/embed/seats" }));
  const read: JsonObject = { extractList: { item: SEATS, fields: {} }, browserFrameId: 7, browserFrameUrlPath: "/embed/seats" };
  const answered = webAutomationExtractListAnswered(read, { extracted: [] }) as JsonObject;
  assert.equal(answered.listKey, keyOf(handles, seats));
});

test("the lists a control is the detected Next of: this Flow's, in its frame, by a `next` way only, most recent first (t1096)", () => {
  const handles = createWebLlmExtractionHandles();
  const NEXT = "nav.pager > a.next";
  const paged = (item: string, extra: Partial<WebLlmExtractionBindingRetained> = {}): WebLlmExtractionBindingRetained => {
    const kept = binding(handles.reserve(), item, extra);
    return { ...kept, extractList: { ...kept.extractList, paginate: { next: NEXT, maxPages: 3 } } };
  };
  handles.retain(SCOPE, paged(SEATS));
  handles.retain(SCOPE, paged(SHOWINGS));
  handles.retain(SCOPE, paged(SEATS));
  handles.retain(SCOPE, paged("main > ul.framed > li", { frameId: 3 }));
  handles.retain({ projectId: "project.one", flowId: "flow.other" }, paged("main > ul.other > li"));
  const numbered = binding(handles.reserve(), "main > ol.numbered > li");
  handles.retain(SCOPE, { ...numbered, extractList: { ...numbered.extractList, paginate: { mode: "numbered", pages: NEXT, maxPages: 3 } } });
  handles.retain(SCOPE, binding(handles.reserve(), "main > ol.unpaged > li"));

  assert.deepEqual(handles.pagedBy(SCOPE, NEXT, undefined), [SEATS, SHOWINGS], "each item once, the latest detection first");
  assert.deepEqual(handles.pagedBy(SCOPE, ` ${NEXT} `, 0), [SEATS, SHOWINGS], "the top frame is frame 0 too");
  assert.deepEqual(handles.pagedBy(SCOPE, NEXT, 3), ["main > ul.framed > li"], "a list in another frame is that frame's");
  assert.deepEqual(handles.pagedBy(SCOPE, "nav.pager > a.prev", undefined), [], "another control is the Next of nothing");
  assert.deepEqual(handles.pagedBy(SCOPE, "", undefined), []);
  assert.deepEqual(handles.pagedBy({ projectId: "project.one", flowId: "flow.none" }, NEXT, undefined), [], "another Flow's lists are not seen");
});
