// What the extension's interference clearing pressed rides on the client
// payload as `clearedLayers` (t401). Core reads it from the top of the dispatch
// payload, as it reads `route`, so the dispatcher lifts it there, copied
// through its closed vocabulary.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ, OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";

async function dispatchWith(payload: JsonObject | undefined): Promise<OutputDispatchResult<JsonObject>> {
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
      automationStudioClientGateway: {
        executeAction: async () => ({ commandId: "client.command.click", status: "succeeded", ...(payload ? { payload } : {}) })
      }
    }
  } as unknown as FluxIQ;
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.click", payload: { selector: "#confirm" } });
}

test("layers the clearing closed are lifted to the top of the dispatch payload", async () => {
  const result = await dispatchWith({ status: "succeeded", clearedLayers: [{ kind: "rate_limit", control: "OK" }, { kind: "dialog", control: "Not now" }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload?.clearedLayers, [{ kind: "rate_limit", control: "OK" }, { kind: "dialog", control: "Not now" }]);
});

test("nothing cleared, or only unknown words, puts no clearedLayers on the dispatch payload", async () => {
  for (const payload of [
    { status: "succeeded" },
    { status: "succeeded", clearedLayers: [] },
    { status: "succeeded", clearedLayers: [{ kind: "rate_limit", control: "Try again" }] },
    { status: "succeeded", clearedLayers: "OK" },
    undefined
  ] as (JsonObject | undefined)[]) {
    const result = await dispatchWith(payload);
    assert.equal(Object.hasOwn(result.payload ?? {}, "clearedLayers"), false, JSON.stringify(payload));
  }
});
