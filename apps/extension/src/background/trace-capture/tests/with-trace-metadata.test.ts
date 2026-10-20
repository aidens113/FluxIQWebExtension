// Coverage of with-trace-metadata.ts: the references go on `metadata.trace`,
// metadata already on the result is kept, the input result is not changed,
// and nothing is added at the top level (Core's durable path refuses a result
// with an unknown top-level key).

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActionResult } from "../../../shared/protocol";
import { withTraceMetadata } from "../with-trace-metadata";

const TRACE = {
  artifacts: [
    { sha256: "a".repeat(64), mediaType: "text/html", byteLength: 10, role: "primary" as const, source: "https://shop.test/" },
    { sha256: "b".repeat(64), mediaType: "image/png", byteLength: 4, role: "resource" as const }
  ],
  unavailable: 1
};

test("the references are set on metadata.trace beside the metadata the result already has", () => {
  const result: ClientGatewayActionResult = { commandId: "c-1", status: "failed", metadata: { requestedActionType: "web.dom.nope" } };
  const traced = withTraceMetadata(result, TRACE);
  assert.deepEqual(traced, {
    commandId: "c-1",
    status: "failed",
    metadata: {
      requestedActionType: "web.dom.nope",
      trace: {
        artifacts: [
          { sha256: "a".repeat(64), mediaType: "text/html", byteLength: 10, role: "primary", source: "https://shop.test/" },
          { sha256: "b".repeat(64), mediaType: "image/png", byteLength: 4, role: "resource" }
        ],
        unavailable: 1
      }
    }
  });
  assert.deepEqual(result, { commandId: "c-1", status: "failed", metadata: { requestedActionType: "web.dom.nope" } }, "the input is not changed");
  assert.deepEqual(Object.keys(traced).sort(), ["commandId", "metadata", "status"]);
});

test("a result with no metadata gets one holding only the trace", () => {
  const traced = withTraceMetadata({ commandId: "c-2", status: "succeeded" }, { artifacts: [], unavailable: 1 });
  assert.deepEqual(traced.metadata, { trace: { artifacts: [], unavailable: 1 } });
});
