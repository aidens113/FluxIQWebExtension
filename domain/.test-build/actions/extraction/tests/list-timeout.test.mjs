// src/actions/extraction/tests/list-timeout.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 1e4;
function webAutomationExtractListTimeoutMs(request2) {
  const paginate = request2.paginate;
  const pages = paginate === void 0 ? 1 : paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  return WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS * pages;
}

// src/actions/extraction/tests/list-timeout.test.ts
var fields = { name: "td.name" };
function request(paginate) {
  return { item: "tr", fields, ...paginate === void 0 ? {} : { paginate } };
}
test("an unpaginated read gets one page's wait", () => {
  assert.equal(webAutomationExtractListTimeoutMs(request()), WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
  assert.equal(WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS, 1e4, "the per-page wait the page applies");
});
test("every mode that follows pages scales by maxPages", () => {
  assert.equal(webAutomationExtractListTimeoutMs(request({ next: "a.next", maxPages: 3 })), 3e4);
  assert.equal(webAutomationExtractListTimeoutMs(request({ mode: "loadMore", control: "button.more", maxPages: 5 })), 5e4);
  assert.equal(webAutomationExtractListTimeoutMs(request({ mode: "numbered", pages: "a.page", maxPages: 2 })), 2e4);
});
test("scroll scales by the scrolls it may make, which is its own bound", () => {
  assert.equal(webAutomationExtractListTimeoutMs(request({ mode: "scroll", maxScrolls: 4 })), 4e4);
});
test("the timeout always outlasts Core's 5,000 ms default", () => {
  for (const paginate of [void 0, { next: "a.next", maxPages: 1 }, { mode: "scroll", maxScrolls: 1 }]) {
    assert.ok(webAutomationExtractListTimeoutMs(request(paginate)) > 5e3, JSON.stringify(paginate) ?? "unpaginated");
  }
});
