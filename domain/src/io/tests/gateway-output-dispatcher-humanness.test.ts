// A click, type or scroll run above humanness 0 answers with a `humanness`
// record on its payload (`actions/humanness-record.ts`). Core keeps the
// dispatch payload as the attempt's `outputs.result` and its Flow step log
// reads the record at that payload's top (Core
// `runtime/llm/step-log/flow-step.ts`). The dispatcher nests the client payload
// under `result`, so until t898 the record sat one level too deep and no replay
// step recorded it. It is lifted as `skipped` is; a level-0 answer, which
// carries none, is dispatched exactly as before.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ, OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";

async function dispatchWith(status: string, payload: JsonObject | undefined): Promise<OutputDispatchResult<JsonObject>> {
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"], metadata: { domainId: "web-automation" } }]
          }]
        })
      },
      automationStudioClientGateway: {
        executeAction: async () => ({ commandId: "client.command.press", status, ...(payload ? { payload } : {}) })
      }
    }
  } as unknown as FluxIQ;
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.click", payload: { selector: "#apply" } });
}

test("a press made above humanness 0 says how at the top of the dispatch payload, and keeps the client's payload as it came", async () => {
  const humanness = { level: 100, aimed: true, misclick: { x: 12, y: 40 } };
  const result = await dispatchWith("succeeded", { status: "succeeded", actionType: "web.dom.click", humanness });
  assert.deepEqual(result.payload?.humanness, humanness);
  assert.deepEqual((result.payload?.result as JsonObject).humanness, humanness);
});

test("a failed press keeps its record too: it was still made that way", async () => {
  const result = await dispatchWith("failed", { status: "failed", actionType: "web.dom.click", message: "nothing changed", humanness: { level: 60, aimed: false } });
  assert.deepEqual(result.payload?.humanness, { level: 60, aimed: false });
});

test("only the record's own fields are lifted", async () => {
  const result = await dispatchWith("succeeded", { status: "succeeded", humanness: { level: 80, aimed: true, stray: "page text", misclick: { x: 1, y: 2, z: 3 } } });
  assert.deepEqual(result.payload?.humanness, { level: 80, aimed: true, misclick: { x: 1, y: 2 } });
});

test("a level-0 answer, or an unreadable record, is dispatched byte for byte as before", async () => {
  const plain: JsonObject = { status: "succeeded", actionType: "web.dom.click", message: "Clicked." };
  const result = await dispatchWith("succeeded", plain);
  // The dispatch payload this answer had before the lift existed.
  assert.equal(JSON.stringify(result.payload), JSON.stringify({ status: "succeeded", result: plain }));
  for (const humanness of [{ level: "high", aimed: true }, { level: 50 }, "100", null, [1]]) {
    const unreadable = await dispatchWith("succeeded", { ...plain, humanness } as JsonObject);
    assert.equal(Object.hasOwn(unreadable.payload ?? {}, "humanness"), false, JSON.stringify(humanness));
  }
  const empty = await dispatchWith("succeeded", undefined);
  assert.equal(Object.hasOwn(empty.payload ?? {}, "humanness"), false);
});
