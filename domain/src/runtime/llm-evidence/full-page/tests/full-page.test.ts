// Core's full-page hook (t1036, D5, `../full-page.ts`): the capture that also
// lists hidden elements, restamped, published with the hidden elements and the
// attributes as extra lines, and kept under the result it was shown as.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webLlmFullPage, type WebLlmFullPageRequest } from "..";
import { webLlmPageViewText, type WebLlmPageView } from "../../page-view";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { RecoverableToolRejection } from "../../tool-rejection";

const REQUEST: WebLlmFullPageRequest = { projectId: "project", flowId: "flow", callId: "call.full.1" };
const SNAPSHOT: JsonObject = {
  url: "https://shop.test/store/",
  title: "Store",
  interactiveElements: [
    { tagName: "button", selector: "#go", accessibleName: "Go", bounds: { x: 0, y: 0, width: 80, height: 20 } },
    { tagName: "a", selector: "#menu a", accessibleName: "Claim offer", href: "https://shop.test/offer", hidden: true }
  ]
};

test("the hook returns the published page whose view holds the hidden element as an extra line, keyed by the page", async () => {
  const handles = createWebLlmStableTargetHandles();
  const kept: Array<{ binding: WebLlmSnapshotBinding; shown: JsonObject }> = [];
  const fullPage = webLlmFullPage({
    capture: async () => sanitizeWebLlmSnapshotWithBindings(SNAPSHOT),
    restamp: (request, binding) => handles.restamp({ projectId: request.projectId, flowId: request.flowId }, binding),
    keep: (_request, binding, shown) => kept.push({ binding, shown })
  });
  const shown = await fullPage(REQUEST);
  assert.ok(shown);
  assert.equal(shown.schemaVersion, "web-llm-page.v4");
  const view = shown.pageView as unknown as WebLlmPageView;
  assert.equal(view.key, "https://shop.test/store");
  const hidden = view.lines.find((line) => line.text.includes("Claim offer"));
  assert.equal(hidden?.extra, true, "the hidden element is an extra line");
  assert.match(hidden?.text ?? "", /^t\d+ hidden link "Claim offer"$/u);
  assert.ok(view.lines.some((line) => line.key === "FULL" && line.extra === true));
  assert.ok(view.lines.some((line) => line.extra !== true && /^t\d+ button "Go"$/u.test(line.text)), "the ordinary view's own line is there, not extra");
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.shown, shown, "kept under the very result it was shown as");
  assert.match(webLlmPageViewText(view), /Claim offer/u);
});

test("a hidden element's handle is the one the run gives it, and a visible element keeps the handle an ordinary look gave it", async () => {
  const handles = createWebLlmStableTargetHandles();
  const scope = { projectId: REQUEST.projectId, flowId: REQUEST.flowId };
  const look = handles.restamp(scope, sanitizeWebLlmSnapshotWithBindings({ ...SNAPSHOT, interactiveElements: [(SNAPSHOT.interactiveElements as JsonObject[])[0]!] }));
  const go = look.evidence.elements[0]!.target;
  const fullPage = webLlmFullPage({
    capture: async () => sanitizeWebLlmSnapshotWithBindings(SNAPSHOT),
    restamp: (request, binding) => handles.restamp({ projectId: request.projectId, flowId: request.flowId }, binding),
    keep: () => undefined
  });
  const view = (await fullPage(REQUEST))!.pageView as unknown as WebLlmPageView;
  assert.ok(view.lines.some((line) => line.key === go && line.extra !== true), `${go} keeps its handle`);
});

test("no page to read now answers nothing; any other failure is not hidden", async () => {
  const unreadable = webLlmFullPage({ capture: async () => { throw new RecoverableToolRejection("page_unreadable"); }, restamp: (_request, binding) => binding, keep: () => undefined });
  assert.equal(await unreadable(REQUEST), undefined);
  const broken = webLlmFullPage({ capture: async () => { throw new Error("gateway broke"); }, restamp: (_request, binding) => binding, keep: () => undefined });
  await assert.rejects(broken(REQUEST), /gateway broke/u);
  const aborted = new AbortController();
  aborted.abort(new Error("stopped"));
  await assert.rejects(unreadable({ ...REQUEST, signal: aborted.signal }), /stopped/u);
});
