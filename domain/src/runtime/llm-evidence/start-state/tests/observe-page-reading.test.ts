// Every start-state read is also a reading of the whole page (FluxIQ Core t791
// fix 1, `flow-bootstrap/site-reset/page-collection.ts`): it names the page
// (`scope`) and the subjects the page shows (`subjects`), whether or not the page
// holds a list the domain vouches for, and an empty state answers no subjects
// rather than none at all. So a creation pressed on an item's own page can name
// the page where its line will show, and Core sees that line appear. The site is
// a library: a book's own page and the reader's shelf, drawn in plain blocks.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime } from "../..";
import type { WebLlmEvidenceGateway } from "../../capture";
import { webControlSpotToken, webTargetSpot } from "../../control-spot";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const request = { projectId: "project", flowId: "flow", callId: "start", permission: automationStudioActionPermissionDenied };
const TITLE = "Atlas of Northern Rivers";

/** A book's own page: its heading, and the add pressed there, about the nearest titled part. */
const bookPage = (): JsonObject => ({
  url: "https://library.test/book/41",
  title: TITLE,
  interactiveElements: [
    { tagName: "h1", selector: "#title", visibleText: TITLE, bounds: box(0, 0, 400, 40), context: { subject: TITLE } },
    { tagName: "button", selector: "#shelve", visibleText: "Add to reading shelf", bounds: box(0, 60, 200, 40), context: { subject: TITLE } }
  ]
});

/** The shelf in plain blocks: each line a block with its book's link, no list or table role anywhere. */
const shelfPage = (titles: readonly string[]): JsonObject => ({
  url: "https://library.test/shelf",
  title: "Reading shelf",
  interactiveElements: [
    { tagName: "div", selector: "#shelf", bounds: box(0, 0, 800, 600) },
    ...titles.flatMap((title, index) => [
      { tagName: "div", selector: `#line-${index}`, bounds: box(0, 40 + index * 60, 800, 50) },
      // The line's link, titled as the capture words it: the same title, with the page's own spacing.
      { tagName: "a", selector: `#line-${index} a`, visibleText: title, bounds: box(0, 40 + index * 60, 300, 20), context: { subject: ` ${title.replace(/ /gu, "\n  ")} ` } },
      { tagName: "span", selector: `#line-${index} .copies`, visibleText: "1 copy", bounds: box(400, 40 + index * 60, 60, 20) }
    ])
  ]
});

/** The shelf before anything is on it: an empty-state panel, holding no list and no line. */
const emptyShelf = (): JsonObject => ({
  url: "https://library.test/shelf",
  title: "Reading shelf",
  interactiveElements: [
    { tagName: "div", selector: "#empty", bounds: box(0, 0, 800, 200) },
    { tagName: "p", selector: "#empty p", visibleText: "Nothing on your shelf yet", bounds: box(0, 20, 400, 20) },
    { tagName: "a", selector: "#browse", visibleText: "Browse the catalogue", bounds: box(0, 60, 200, 20) }
  ]
});

function runtimeOver(...snapshots: JsonObject[]) {
  let calls = 0;
  const gateway: WebLlmEvidenceGateway = { eligibleSessionIds: () => ["session"], executeAction: async () => {
    const snapshot = snapshots[Math.min(calls, snapshots.length - 1)]!;
    calls += 1;
    return { status: "succeeded", payload: { snapshot, sourceId: "tab:7:frame:0" } };
  } };
  return createWebAutomationLlmEvidenceRuntime(gateway);
}

test("a page drawn in plain blocks answers its scope and the subjects it shows, with no list", async () => {
  const runtime = runtimeOver(shelfPage([TITLE, "Herbal of the Marsh"]));
  const read = await runtime.startState!(request);
  assert.ok(read?.scope, "the page is named");
  assert.ok(read?.resource, "under its trusted tab");
  assert.deepEqual(read?.collections ?? [], [], "no list the domain vouches for");
  assert.equal(read?.subjects?.length, 2, "one subject per line");
  for (const subject of read?.subjects ?? []) assert.match(subject, /^s:[0-9a-f]{32}$/u);
  assert.doesNotMatch(JSON.stringify(read?.subjects), /Atlas|Herbal/u);
});

test("an empty-state page answers its scope and no subjects, which is a reading, not none", async () => {
  const runtime = runtimeOver(emptyShelf(), shelfPage([TITLE]));
  const empty = await runtime.startState!(request);
  const filled = await runtime.startState!({ ...request, callId: "again" });
  assert.ok(empty?.scope);
  assert.deepEqual(empty?.subjects, [], "an empty page shows no subjects, and says so");
  assert.equal(filled?.scope, empty?.scope, "the same page at the same address is the same page");
  assert.equal(filled?.resource, empty?.resource);
});

test("a shelf line's subject token is the book page's own subject, and the add's page token", async () => {
  const runtime = runtimeOver(bookPage(), shelfPage([TITLE]));
  const book = await runtime.startState!(request);
  const shelf = await runtime.startState!({ ...request, callId: "shelf" });
  const token = webControlSpotToken("subject", TITLE);
  assert.ok(book?.subjects?.includes(token), "the book page's heading");
  assert.deepEqual(shelf?.subjects, [token], "the shelf line's link, whatever its spacing");
  const binding = sanitizeWebLlmSnapshotWithBindings(bookPage());
  const add = [...binding.selectors].find(([, selector]) => selector === "#shelve")?.[0];
  const spot = webTargetSpot(binding, add);
  assert.equal(spot.page, token, "what the add's page is about is the line that appears");
  assert.equal(spot.subject, token);
  assert.equal(spot.item, undefined, "the add sits in no item, so its page stands for it (Core identified creation)");
});
