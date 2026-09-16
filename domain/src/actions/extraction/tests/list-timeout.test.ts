// D14: a recorded list extraction states its own timeout, scaled by the pages
// it may read.
//
// Core sends a recorded node's timeout as the command timeout and defaults it to
// 5,000 ms, while the page waits up to 10,000 ms for each page of a list. So an
// unscaled recorded node is cut short by its first page, which is the whole
// reason this function exists.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS, webAutomationExtractListTimeoutMs } from "../request";
import type { WebAutomationExtractListRequest } from "../request";

const fields = { name: "td.name" };

function request(paginate?: WebAutomationExtractListRequest["paginate"]): WebAutomationExtractListRequest {
  return { item: "tr", fields, ...(paginate === undefined ? {} : { paginate }) };
}

test("an unpaginated read gets one page's wait", () => {
  assert.equal(webAutomationExtractListTimeoutMs(request()), WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS);
  assert.equal(WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS, 10_000, "the per-page wait the page applies");
});

test("every mode that follows pages scales by maxPages", () => {
  assert.equal(webAutomationExtractListTimeoutMs(request({ next: "a.next", maxPages: 3 })), 30_000);
  assert.equal(webAutomationExtractListTimeoutMs(request({ mode: "loadMore", control: "button.more", maxPages: 5 })), 50_000);
  assert.equal(webAutomationExtractListTimeoutMs(request({ mode: "numbered", pages: "a.page", maxPages: 2 })), 20_000);
});

test("scroll scales by the scrolls it may make, which is its own bound", () => {
  assert.equal(webAutomationExtractListTimeoutMs(request({ mode: "scroll", maxScrolls: 4 })), 40_000);
});

test("the timeout always outlasts Core's 5,000 ms default", () => {
  // The defect this replaces: the node kept Core's default and failed at the
  // first page it waited for.
  for (const paginate of [undefined, { next: "a.next", maxPages: 1 } as const, { mode: "scroll", maxScrolls: 1 } as const]) {
    assert.ok(webAutomationExtractListTimeoutMs(request(paginate)) > 5_000, JSON.stringify(paginate) ?? "unpaginated");
  }
});
