// A next-page step whose list has no next page answers `route: "ended"` on the
// client payload (`client/gateway-mapping.ts`). Core takes a dispatched
// action's route from the top level of the dispatch payload (contract C1), so
// the dispatcher lifts it there: only that literal, and nothing otherwise.

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
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.next_page"] }]
          }]
        })
      },
      automationStudioClientGateway: {
        executeAction: async () => ({ commandId: "client.command.next", status: "succeeded", ...(payload ? { payload } : {}) })
      }
    }
  } as unknown as FluxIQ;
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.next_page", payload: { nextPage: { item: "li.result" } } });
}

test("an ended answer puts route ended at the top of the dispatch payload", async () => {
  const result = await dispatchWith({ status: "succeeded", nextPage: { outcome: "ended", stop: "control_absent" }, route: "ended" });
  assert.equal(result.ok, true);
  assert.equal(result.payload?.route, "ended");
  assert.deepEqual((result.payload?.result as JsonObject).nextPage, { outcome: "ended", stop: "control_absent" });
});

test("a move, or any other route word, puts no route on the dispatch payload", async () => {
  for (const payload of [
    { status: "succeeded", nextPage: { outcome: "moved", by: "next" } },
    { status: "succeeded", route: "success" },
    { status: "succeeded", route: ["ended"] },
    undefined
  ] as (JsonObject | undefined)[]) {
    const result = await dispatchWith(payload);
    assert.equal(Object.hasOwn(result.payload ?? {}, "route"), false, JSON.stringify(payload));
  }
});
