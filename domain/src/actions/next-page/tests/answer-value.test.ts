// `web.dom.next_page`'s answer (contract C1), copied field by field: what moved
// the list and the page it now shows, why there is no next page, or why the
// move failed. Words only from the closed sets, and nothing a producer put
// beside them.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationNextPageAnswerValue } from "../answer-value";

test("a move, an end and a fault are read as written", () => {
  for (const answer of [
    { outcome: "moved", by: "next" },
    { outcome: "moved", by: "numbered", page: 3 },
    { outcome: "moved", by: "following" },
    { outcome: "moved", by: "loadMore" },
    { outcome: "moved", by: "scroll" },
    { outcome: "ended", stop: "control_absent" },
    { outcome: "ended", stop: "control_disabled" },
    { outcome: "ended", stop: "no_following_page" },
    { outcome: "ended", stop: "scrolled_to_end" },
    { outcome: "failed", stop: "list_unchanged" },
    { outcome: "failed", stop: "rate_limited" },
    { outcome: "failed", stop: "list_vanished" },
    { outcome: "failed", stop: "control_not_clickable" },
    { outcome: "failed", stop: "page_fault" }
  ]) {
    assert.deepEqual(webAutomationNextPageAnswerValue(answer), answer, JSON.stringify(answer));
  }
});

test("nothing a producer put beside the declared fields is carried", () => {
  assert.deepEqual(webAutomationNextPageAnswerValue({ outcome: "moved", by: "next", page: 2, label: "Page 2 of 9" }), { outcome: "moved", by: "next", page: 2 });
  assert.deepEqual(webAutomationNextPageAnswerValue({ outcome: "ended", stop: "control_absent", page: 4 }), { outcome: "ended", stop: "control_absent" });
});

test("a word outside its outcome's set, or a page that is not a page number, is not an answer", () => {
  for (const answer of [
    { outcome: "moved" },
    { outcome: "moved", by: "click" },
    { outcome: "moved", by: "next", page: 0 },
    { outcome: "moved", by: "next", page: 1.5 },
    { outcome: "moved", by: "next", page: "2" },
    { outcome: "ended", stop: "rate_limited" },
    { outcome: "ended", stop: "page_limit" },
    { outcome: "failed", stop: "control_absent" },
    { outcome: "failed", stop: "deadline" },
    { outcome: "stopped", stop: "control_absent" },
    "moved",
    null,
    undefined,
    []
  ]) {
    assert.equal(webAutomationNextPageAnswerValue(answer), undefined, JSON.stringify(answer));
  }
});
