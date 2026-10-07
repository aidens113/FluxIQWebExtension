// The runtime path a Flow run takes: a next-page step whose list has no next
// page reaches Core with `route: "ended"` at the top of the runtime result's
// payload (contract C1), where Core takes a dispatched action's route from.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";

const nextPageCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.next",
  outputId: "web.dom.next_page",
  parameters: { nextPage: { item: "li.result" } }
};

async function runNextPage(payload: JsonObject): Promise<FluxIQRuntimeCommandResult> {
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
      automationStudioClientGateway: { executeAction: async () => ({ commandId: "client.command.next", status: "succeeded", payload }) }
    }
  } as unknown as FluxIQ;
  return await createWebAutomationRuntimeAdapter({ fluxiq }).execute(nextPageCommand, {});
}

function clientPayload(extra: JsonObject): JsonObject {
  return {
    commandId: "client.command.next",
    actionType: "web.dom.next_page",
    status: "succeeded",
    validation: { status: "passed", expected: "the list to show its next page, or to have none", actual: "it had none" },
    ...extra
  };
}

test("a Flow run's next page that ended returns route ended at the top of the payload", async () => {
  const result = await runNextPage(clientPayload({ nextPage: { outcome: "ended", stop: "no_following_page" }, route: "ended" }));
  assert.equal(result.status, "succeeded");
  assert.equal((result.payload as JsonObject).route, "ended");
  assert.deepEqual(((result.payload as JsonObject).result as JsonObject).nextPage, { outcome: "ended", stop: "no_following_page" });
});

test("a Flow run's next page that moved returns no route", async () => {
  const result = await runNextPage(clientPayload({ nextPage: { outcome: "moved", by: "following" } }));
  assert.equal(Object.hasOwn(result.payload as JsonObject, "route"), false);
});
