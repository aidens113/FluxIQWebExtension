// A press the site refused for now (`../wait-words.ts`, t741 C1b): its next
// says the site's wait, rounded up to whole seconds, and that the tab was taken
// back, after the reason's own next; with neither known, next is unchanged.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmRejectionNextWithWait } from "../wait-words";

test("the wait and the return follow the reason's own next, and nothing is added when neither is known", () => {
  const next = "Make this press again later.";
  assert.equal(webLlmRejectionNextWithWait(next, undefined, undefined), next);
  assert.equal(webLlmRejectionNextWithWait(undefined, undefined, undefined), undefined);
  const both = webLlmRejectionNextWithWait(next, 4200, true) ?? "";
  assert.ok(both.startsWith(`${next} The site asked to wait 5 seconds`), both);
  assert.match(both, /The tab was taken back to the page it showed before the press/u);
  assert.equal(webLlmRejectionNextWithWait(undefined, 300, undefined), "The site asked to wait 1 second before this is made again.");
});
