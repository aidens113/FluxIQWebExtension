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
