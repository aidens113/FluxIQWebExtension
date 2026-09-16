// Which document an extraction reads, and why a request may not say so.
//
// X5.4 planned an iframe extraction workflow, and the Lab's translator refused
// a `frame:` target because `WebAutomationExtractListRequest` has no frame
// member. The decision taken is that it never gains one: an extraction is
// addressed to a frame on the action, exactly as a click is, and that address
// already travels end to end. These rows hold both halves of it -- a request
// that names a frame is refused rather than read against another document, and
// a recorded extraction carries the frame it was recorded in all the way to the
// dispatched command.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand } from "../../../client";
import { webAutomationOutputPayload } from "../../../output-nodes";
import { webAutomationExtractListRequestValue } from "../read-request";

const request = { item: "tr.order-line", fields: { sku: "td.sku", qty: "td.qty" } };

const definition = {
  form: "list",
  datasetId: "order-lines:4f1c9a",
  label: "Order lines",
  itemCount: 3,
  request,
  fieldLabels: { sku: "SKU", qty: "Quantity" }
};

/** The frame of a recorded `data.extract`, as the recorder's event carries it. */
function recorded(browserFrameId: number, url: string): JsonObject {
  return { kind: "data.extract", sequence: 3, url, title: "Checkout", eventTimestampMs: 1_100, browserFrameId, extraction: definition } as unknown as JsonObject;
}

test("a request is read when it names no frame", () => {
  assert.deepEqual(webAutomationExtractListRequestValue(request), request);
});

test("a request that names a frame is refused whole, rather than read against another document", () => {
  for (const key of ["frame", "frameId", "frameSelector", "frameUrlPath"]) {
    assert.equal(
      webAutomationExtractListRequestValue({ ...request, [key]: key === "frameId" ? 4 : "iframe#payment" }),
      undefined,
      `a request naming ${key} is not an extraction request`
    );
  }
  // Frame 0 is the top frame rather than an absent one, so naming it is still
  // naming a frame: the request would otherwise look like it had pinned the
  // document it happens to be delivered to.
  assert.equal(webAutomationExtractListRequestValue({ ...request, frameId: 0 }), undefined);
});

test("a recorded extraction replays into the frame it was recorded in, with no frame in its request", () => {
  const parameters = webAutomationOutputPayload("web.dom.extract_list", recorded(4, "http://127.0.0.1:5174/scenarios/iframe-checkout/payment?session=tok-123"));
  assert.deepEqual(parameters.extractList, request, "the node carries the request, and the request names no frame");
  assert.equal(parameters.browserFrameId, 4, "the recorded frame is on the node");
  assert.equal(parameters.browserFrameUrlPath, "/scenarios/iframe-checkout/payment", "and its document path, which finds the frame again after Chrome renumbers it");
  assert.equal(JSON.stringify(parameters).includes("session=tok-123"), false, "the pathname alone, so a frame's query carries no token into the node");

  const command = webAutomationActionFromGatewayCommand({ commandId: "command.order-lines", actionType: "web.dom.extract_list", parameters });
  assert.equal("status" in command, false, "the command is not rejected");
  if ("status" in command) return;
  assert.equal(command.frameId, 4, "the dispatched command is addressed to that frame");
  assert.equal(command.frameUrlPath, "/scenarios/iframe-checkout/payment");
  assert.deepEqual(command.extractList, request, "and the read it runs there is the one that was recorded");
});

test("a top-frame extraction names no path, and frame 0 survives as a frame", () => {
  const parameters = webAutomationOutputPayload("web.dom.extract_list", recorded(0, "http://127.0.0.1:5174/scenarios/iframe-checkout"));
  assert.equal(parameters.browserFrameId, 0);
  assert.equal(parameters.browserFrameUrlPath, undefined, "the top frame is never renumbered, so it needs no path");
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.top", actionType: "web.dom.extract_list", parameters });
  assert.equal("status" in command ? undefined : command.frameId, 0, "frame 0 is the top frame, not an absent frame");
});
