// The published page: what is kept from the packet, what is now only in the
// page's lines, and the key it is retained by.

import assert from "node:assert/strict";
import test from "node:test";
import { publishedWebLlmPage } from "../published-page";
import { webLlmPageRetentionKey } from "../retention-key";
import { WEB_LLM_PAGE_SCHEMA_VERSION } from "../schema-version";
import { webLlmPageViewText } from "../joined-text";
import { fixturePacket } from "./packet-fixture";

test("an observation keeps its location and truncated flag, and says everything else in its page", () => {
  const published = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Go" }], {
    title: "Kettles", frame: { isTop: true }, selectedText: "Gooseneck", dialogs: [{ name: "Cookies", modal: true }]
  }));
  assert.equal(WEB_LLM_PAGE_SCHEMA_VERSION, "web-llm-page.v4");
  assert.deepEqual(Object.keys(published), ["schemaVersion", "trust", "location", "truncated", "pageView", "judgeState"]);
  assert.equal(published.schemaVersion, "web-llm-page.v4");
  assert.equal(published.pageView.key, "https://shop.test/store/s", "keyed by the normalized location, without its query");
  assert.equal(published.trust, "untrusted-page-evidence");
  assert.equal(published.location, "https://shop.test/store/s?k=kettle", "the exact screened location, which plan resolution compares");
  assert.equal(published.truncated, false);
  assert.match(webLlmPageViewText(published.pageView), /^PAGE "Kettles"$/mu);
  assert.match(webLlmPageViewText(published.pageView), /^DIALOG "Cookies" modal$/mu);
  assert.match(webLlmPageViewText(published.pageView), /^SELECTED "Gooseneck"$/mu);
  for (const dropped of ["title", "frame", "loading", "navigation", "dialogs", "blockedBy", "selectedText", "captureTruncated", "elements"]) {
    assert.equal(dropped in published, false, `${dropped} is no longer a key`);
  }
});

test("versioned semantic state accompanies the same view with false/empty values and modest publication overhead", (t) => {
  const packet = fixturePacket([
    { tag: "input", name: "Updates", checked: false },
    { tag: "input", name: "Comment", value: "" },
    { tag: "select", name: "Region", selectedValue: "" },
    { tag: "p", role: "status", text: "Preference removed" },
    ...Array.from({ length: 250 }, (_, at) => ({ tag: "p", text: `Supporting unrelated page text ${at + 1}: ` + "context ".repeat(24) }))
  ]);
  const original = structuredClone(packet);
  const published = publishedWebLlmPage(packet);
  assert.equal(published.judgeState?.version, 1);
  assert.deepEqual(published.judgeState?.controls, [{ tag: "input", name: "Updates", checked: false }, { tag: "input", name: "Comment", value: "" }, { tag: "select", name: "Region", selectedValue: "" }]);
  assert.match(JSON.stringify(published.judgeState?.notices), /Preference removed/u);
  assert.doesNotMatch(JSON.stringify(published.judgeState), /Supporting unrelated|"page"|"box"|"target"|"attributes"/u);
  const { judgeState: _semantic, ...legacy } = published;
  const beforeBytes = Buffer.byteLength(JSON.stringify(legacy), "utf8");
  const addedBytes = Buffer.byteLength(JSON.stringify(published), "utf8") - beforeBytes;
  const semanticBytes = Buffer.byteLength(JSON.stringify(published.judgeState), "utf8");
  t.diagnostic(JSON.stringify({ case: "synthetic semantic witness", sourceElements: packet.elements.length, oldPublishedBytes: beforeBytes, addedMetadataBytes: addedBytes, semanticStateBytes: semanticBytes }));
  assert.ok(addedBytes < beforeBytes, "semantic metadata is smaller than the unchanged rendered view");
  assert.deepEqual(packet, original);
});

test("a failure packet's marks are carried as they are", () => {
  const published = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Pay" }], {
    failedTarget: "t1", repairParameters: { target: "the control to press" }, repairCandidates: { target: ["t1"] } as never
  }));
  assert.equal(published.failedTarget, "t1");
  assert.deepEqual(published.repairParameters, { target: "the control to press" });
  assert.deepEqual(published.repairCandidates, { target: ["t1"] });
  const missing = publishedWebLlmPage(fixturePacket([], { failedTargetMissing: true }));
  assert.equal(missing.failedTargetMissing, true);
  const unknown = publishedWebLlmPage(fixturePacket([], { failedTargetUnknown: true }));
  assert.equal(unknown.failedTargetUnknown, true);
});

test("the retention key is the location, a space, and the page text", () => {
  const published = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Go" }]));
  assert.equal(webLlmPageRetentionKey(published), `${published.location} ${webLlmPageViewText(published.pageView)}`);
  const other = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Stop" }]));
  assert.notEqual(webLlmPageRetentionKey(other), webLlmPageRetentionKey(published));
});
