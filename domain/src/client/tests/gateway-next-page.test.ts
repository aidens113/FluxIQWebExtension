// `web.dom.next_page` on the wire (contract C1). The request rides the command
// as `nextPage`, lifted from the node's parameter and refused whole when it does
// not parse. The answer rides the result payload field by field, and the
// `ended` route only as that literal and only beside an answer that ended.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionCommand, WebAutomationActionResult } from "../../actions/types";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../runtime/failure";
import { webAutomationReadActionParameters } from "../gateway-action-parameters";
import { webAutomationActionFromGatewayCommand, webAutomationActionResultPayload, type WebAutomationActionRejection } from "../gateway-mapping";

const nextPage = { item: "li.result", pagination: { mode: "numbered", pages: "nav.pager a" } };

test("the parameter lift reads nextPage onto the command field", () => {
  assert.deepEqual(webAutomationReadActionParameters({ nextPage }).lifted.nextPage, nextPage);
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.next", actionType: "web.dom.next_page", parameters: { nextPage }, timeoutMs: 30_000 });
  assert.equal("status" in command, false);
  assert.deepEqual((command as WebAutomationActionCommand).nextPage, nextPage);
  assert.equal((command as WebAutomationActionCommand).timeoutMs, 30_000);
});

test("the legacy alias dom.next_page maps to the action", () => {
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.next", actionType: "dom.next_page", parameters: { nextPage } });
  assert.equal((command as WebAutomationActionCommand).actionType, "web.dom.next_page");
});

test("a nextPage that does not parse refuses the command whole", () => {
  const reading = webAutomationReadActionParameters({ nextPage: { item: "li.result", pagination: { next: "a.next", maxPages: 2 } } });
  assert.equal(reading.lifted.nextPage, undefined);
  assert.deepEqual(reading.refused, ["nextPage"]);
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.next", actionType: "web.dom.next_page", parameters: { nextPage: { item: "" } } });
  assert.equal((command as WebAutomationActionRejection).status, "rejected");
  assert.equal((command as WebAutomationActionRejection).failure.code, WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER);
});

const base: WebAutomationActionResult = {
  commandId: "command.next",
  actionType: "web.dom.next_page",
  status: "succeeded",
  validation: { status: "passed", expected: "the list to show its next page", actual: "it did" },
  startedAt: 1,
  finishedAt: 2
};

test("a move carries its answer and no route", () => {
  const payload = webAutomationActionResultPayload({ ...base, nextPage: { outcome: "moved", by: "numbered", page: 3 } });
  assert.deepEqual(payload.nextPage, { outcome: "moved", by: "numbered", page: 3 });
  assert.equal(Object.hasOwn(payload, "route"), false);
});

test("an end carries its answer and route ended", () => {
  const payload = webAutomationActionResultPayload({ ...base, nextPage: { outcome: "ended", stop: "control_disabled" }, route: "ended" });
  assert.deepEqual(payload.nextPage, { outcome: "ended", stop: "control_disabled" });
  assert.equal(payload.route, "ended");
});

test("the answer is copied field by field, and a route is carried only as the literal beside an end", () => {
  const extra = webAutomationActionResultPayload({ ...base, nextPage: { outcome: "moved", by: "next", note: "Page 2 of 9" } as never });
  assert.deepEqual(extra.nextPage, { outcome: "moved", by: "next" });
  const malformed = webAutomationActionResultPayload({ ...base, nextPage: { outcome: "ended", stop: "deadline" } as never, route: "ended" });
  assert.equal(Object.hasOwn(malformed, "nextPage"), false);
  assert.equal(Object.hasOwn(malformed, "route"), false);
  const moved = webAutomationActionResultPayload({ ...base, nextPage: { outcome: "moved", by: "scroll" }, route: "ended" });
  assert.equal(Object.hasOwn(moved, "route"), false);
  const other = webAutomationActionResultPayload({ ...base, nextPage: { outcome: "ended", stop: "scrolled_to_end" }, route: "success" as never });
  assert.equal(Object.hasOwn(other, "route"), false);
  assert.equal(Object.hasOwn(webAutomationActionResultPayload(base) as JsonObject, "nextPage"), false);
});
