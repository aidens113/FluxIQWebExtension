// A Flow run returns a web node's result to Core by the dispatch path, not the
// build's evidence loop: the client's gateway payload rides whole under
// `payload.result` (`io/gateway-output-dispatcher.ts`, `../adapter.ts`). So a
// robot check that cleared by itself reaches Core there as
// `payload.result.checkWait`, put on by `client/gateway-mapping.ts`, with no
// copy of its own on this side to drop it.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";

const clickCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.click",
  outputId: "web.dom.click",
  parameters: { selector: "#go" }
};

async function runClick(payload: JsonObject, status = "succeeded"): Promise<FluxIQRuntimeCommandResult> {
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"] }]
          }]
        })
      },
      automationStudioClientGateway: { executeAction: async () => ({ commandId: "client.command.click", status, payload }) }
    }
  } as unknown as FluxIQ;
  return await createWebAutomationRuntimeAdapter({ fluxiq }).execute(clickCommand, {});
}

function clientPayload(extra: JsonObject = {}): JsonObject {
  return {
    commandId: "client.command.click",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "passed", expected: "the click to be made", actual: "it did" },
    ...extra
  };
}

test("a Flow run's click that waited out a self-clearing check returns checkWait to Core under payload.result", async () => {
  const result = await runClick(clientPayload({ checkWait: { waitedMs: 8_412 } }));
  assert.equal(result.status, "succeeded");
  assert.deepEqual(((result.payload as JsonObject).result as JsonObject).checkWait, { waitedMs: 8_412 });
});

test("a Flow run's click that met no check returns no checkWait", async () => {
  const result = await runClick(clientPayload());
  assert.equal("checkWait" in ((result.payload as JsonObject).result as JsonObject), false);
});

// Core reads the cleared wait as the runtime command result's own
// `clearedWait`, never off the payload, so the adapter carries it up from the
// dispatch result that lifted it.
test("a Flow run's click that waited out a self-clearing check carries clearedWait on the runtime result", async () => {
  const result = await runClick(clientPayload({ checkWait: { waitedMs: 8_412 } }));
  assert.deepEqual(result.clearedWait, { waitedMs: 8_412 });
});

test("a Flow run's click that met no check carries no clearedWait key", async () => {
  const result = await runClick(clientPayload());
  assert.equal("clearedWait" in result, false);
});

test("a malformed checkWait puts no clearedWait on the runtime result", async () => {
  for (const checkWait of [{ waitedMs: -1 }, { waitedMs: "8412" }, { waitedMs: 600_001 }, "8412", [8_412], {}] as unknown as JsonObject[]) {
    const result = await runClick(clientPayload({ checkWait }));
    assert.equal("clearedWait" in result, false, JSON.stringify(checkWait));
  }
});

test("a failed runtime click carries the check it cleared before failing", async () => {
  const result = await runClick(clientPayload({ status: "failed", checkWait: { waitedMs: 7 } }), "failed");
  assert.equal(result.status, "failed");
  assert.deepEqual(result.clearedWait, { waitedMs: 7 });
});
