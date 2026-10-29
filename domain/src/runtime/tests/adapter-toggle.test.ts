// The runtime path a Flow run and its trials take (t792): a press that flipped
// its own control reaches Core with the signature lifted to the top of the
// runtime result's payload as `toggle: { signature }`, beside the client's own
// result kept whole under `result` (its raw `toggle` included). Core's runtime
// dispatcher keeps that payload as the attempt's `outputs.result`, and the
// build's record of toggles reads `outputs.result.toggle` from it (Core
// `flow-bootstrap/explored-toggles.ts`). Core's project-build test of a trial's
// toggle reaching the next revision copies this shape
// (`service/project-build/tests/project-build-shared-toggles.test.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";

const pressCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.pin",
  outputId: "web.dom.click",
  parameters: { selector: "main > ul > li:nth-of-type(2) button.pin" }
};

const PINNED = { via: "name", gains: ["unpin"], loses: ["pin"] };

async function press(payload: JsonObject): Promise<FluxIQRuntimeCommandResult> {
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
      automationStudioClientGateway: { executeAction: async () => ({ commandId: "client.command.pin", status: "succeeded", message: "Element clicked.", payload }) }
    }
  } as unknown as FluxIQ;
  return await createWebAutomationRuntimeAdapter({ fluxiq }).execute(pressCommand, {});
}

/** The client's action result for a press, as the click verb and the extension's gateway mapping send it. */
function clientResult(extra: JsonObject): JsonObject {
  return {
    commandId: "client.command.pin",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "passed", expected: "the click lands on the target or something inside it", actual: "the point 814,551 landed on svg, inside the target" },
    message: "Element clicked.",
    url: "https://notes.test/saved",
    resolution: { strategy: "selector", candidateCount: 1, bestScore: 0.792, confidence: 0.697 },
    ...extra
  };
}

test("a Flow run's press that flipped its control returns its toggle at the top of the runtime payload, the client's result kept whole", async () => {
  const result = await press(clientResult({ toggle: PINNED }));
  assert.equal(result.status, "succeeded");
  const payload = result.payload as JsonObject;
  assert.deepEqual(payload.toggle, { signature: PINNED });
  assert.equal(payload.status, "succeeded");
  assert.deepEqual((payload.result as JsonObject).toggle, PINNED);
  assert.equal(Object.hasOwn(payload, "skipped"), false);
});

test("a Flow run's press skipped as already in its state returns no toggle", async () => {
  const result = await press(clientResult({ skipped: "already_in_state", toggle: PINNED }));
  const payload = result.payload as JsonObject;
  assert.equal(payload.skipped, "already_in_state");
  assert.equal(Object.hasOwn(payload, "toggle"), false);
});
