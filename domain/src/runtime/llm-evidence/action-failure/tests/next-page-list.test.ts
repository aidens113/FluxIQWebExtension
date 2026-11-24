// A Next page asked where its list is not (t1013): refused `target_not_found` for `list_not_on_page`, naming the list
// by the handle the call wrote, never as a move whose outcome is uncertain (bikes run-mwug2xjw-41f62603, step 0089).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationFailureRecord, WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import { webActionFailureRefusal, webNextPageListNamed } from "..";

const absent = { status: "failed" as const, failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND), payload: { nextPage: { outcome: "failed", stop: "list_vanished" } } as JsonObject };

test("a Next page whose list is not on the page is refused for that reason", () => {
  const refused = webActionFailureRefusal(absent);
  assert.equal(refused.code, "target_not_found");
  assert.equal(refused.detail?.reason, "list_not_on_page");
});

test("the refusal names the list in every way the call writes it, and says to go back to it", () => {
  const written: JsonObject[] = [
    { nextPage: "extraction.3" },
    { nextPage: { list: "extraction.3" } },
    { nextPage: { list: "extraction.3", control: "t9" } },
    { nextPage: { list: { handle: "extraction.3", location: "/list" } } },
    { nextPage: { handle: "extraction.3" } }
  ];
  for (const call of written) {
    const named = webNextPageListNamed(webActionFailureRefusal(absent), call);
    assert.equal(named.code, "target_not_found");
    assert.equal(named.detail?.target, "extraction.3", JSON.stringify(call));
    assert.match(String(named.detail?.next), /Nothing was pressed: the list extraction\.3 is not on this page.*Go back to the page that shows extraction\.3, then run Next page there/u);
  }
});

test("a call that wrote no list handle is told the same reason without a name, and nothing else is renamed", () => {
  const literal = webNextPageListNamed(webActionFailureRefusal(absent), { nextPage: { item: "li.row" } });
  assert.equal(literal.detail?.reason, "list_not_on_page");
  assert.equal(literal.detail?.target, undefined);
  assert.match(String(literal.detail?.next), /the list this Next page moves is not on this page/u);
  const other = webActionFailureRefusal({ status: "failed", failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND) });
  assert.equal(webNextPageListNamed(other, { nextPage: "extraction.3" }), other);
});

test("a list that vanished after a press stays a move whose output was not seen", () => {
  const after = webActionFailureRefusal({ status: "failed", failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED), payload: { nextPage: { outcome: "failed", stop: "list_vanished" } } });
  assert.equal(after.code, "output_not_observed");
  assert.notEqual(after.detail?.reason, "list_not_on_page");
});
