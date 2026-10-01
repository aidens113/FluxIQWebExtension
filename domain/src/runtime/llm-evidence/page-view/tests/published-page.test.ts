// The published page: what is kept from the packet, what is now only in the
// page's lines, and the key it is retained by.

import assert from "node:assert/strict";
import test from "node:test";
import { publishedWebLlmPage } from "../published-page";
import { webLlmPageRetentionKey } from "../retention-key";
import { WEB_LLM_PAGE_SCHEMA_VERSION } from "../schema-version";
import { fixturePacket } from "./packet-fixture";

test("an observation keeps its location and truncated flag, and says everything else in its page", () => {
  const published = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Go" }], {
    title: "Kettles", frame: { isTop: true }, selectedText: "Gooseneck", dialogs: [{ name: "Cookies", modal: true }]
  }));
  assert.equal(WEB_LLM_PAGE_SCHEMA_VERSION, "web-llm-page.v3");
  assert.deepEqual(Object.keys(published), ["schemaVersion", "trust", "location", "truncated", "page"]);
  assert.equal(published.schemaVersion, "web-llm-page.v3");
  assert.equal(published.trust, "untrusted-page-evidence");
  assert.equal(published.location, "https://shop.test/store/s?k=kettle", "the exact screened location, which plan resolution compares");
  assert.equal(published.truncated, false);
  assert.match(published.page, /^PAGE "Kettles"$/mu);
  assert.match(published.page, /^DIALOG "Cookies" modal$/mu);
  assert.match(published.page, /^SELECTED "Gooseneck"$/mu);
  for (const dropped of ["title", "frame", "loading", "navigation", "dialogs", "blockedBy", "selectedText", "captureTruncated", "elements"]) {
    assert.equal(dropped in published, false, `${dropped} is no longer a key`);
  }
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

test("the retention key is the location, a space, and the page", () => {
  const published = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Go" }]));
  assert.equal(webLlmPageRetentionKey(published), `${published.location} ${published.page}`);
  const other = publishedWebLlmPage(fixturePacket([{ tag: "button", name: "Stop" }]));
  assert.notEqual(webLlmPageRetentionKey(other), webLlmPageRetentionKey(published));
});
