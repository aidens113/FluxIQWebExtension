// The IO path: Core's `dispatchPolicyOutput` reads a self-clearing robot check
// as the dispatch result's own `clearedWait`, never off the payload. The
// dispatcher lifts it from the client's `checkWait` through the domain's bound
// (`actions/cleared-check-wait.ts`): whole ms, `waitedMs` alone, absent when
// the payload carries none or carries something malformed.

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
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.click", payload: { selector: "#go" } });
}

test("a click whose check cleared by itself dispatches with clearedWait, rounded to a whole ms", async () => {
  const result = await dispatchWith({ status: "succeeded", checkWait: { waitedMs: 8_412.4 } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.clearedWait, { waitedMs: 8_412 });
});

test("only waitedMs rides onto clearedWait", async () => {
  const result = await dispatchWith({ status: "succeeded", checkWait: { waitedMs: 0, note: "extra" } });
  assert.deepEqual(result.clearedWait, { waitedMs: 0 });
});

test("a click that met no check dispatches with no clearedWait key", async () => {
  assert.equal("clearedWait" in await dispatchWith({ status: "succeeded" }), false);
  assert.equal("clearedWait" in await dispatchWith(undefined), false);
});

test("a malformed checkWait dispatches with no clearedWait key", async () => {
  for (const checkWait of [{ waitedMs: -1 }, { waitedMs: "8412" }, { waitedMs: Number.NaN }, { waitedMs: 600_001 }, null, "8412", [8_412], {}] as unknown as JsonObject[]) {
    const result = await dispatchWith({ status: "succeeded", checkWait });
    assert.equal("clearedWait" in result, false, String(JSON.stringify(checkWait)));
  }
});
