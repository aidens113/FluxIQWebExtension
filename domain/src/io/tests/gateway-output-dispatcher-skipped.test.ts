// A press given `ensureState` whose control already showed that state is not
// pressed, and the client answers `skipped: "already_in_state"` on its payload
// (t775). Core keeps the dispatch payload as the attempt's `outputs.result` and
// reads `skipped` at its top (Core `executor/node-execution/already-in-state.ts`).
// The dispatcher nests the client payload under `result`, so until t775-P the
// skip sat one level too deep: the photo-social like loop's skipped pass read
// as an ordinary press and the judge was never told it was already so. The
// dispatcher lifts it, as it lifts `route`: only that literal, only on success.

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
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.click", payload: { selector: "#like", ensureState: { via: "name", gains: ["unlike"], loses: ["like"] } } });
}

test("a press the client skipped already in state says so at the top of the dispatch payload", async () => {
  const result = await dispatchWith("succeeded", { status: "succeeded", actionType: "web.dom.click", skipped: "already_in_state" });
  assert.equal(result.ok, true);
  assert.equal(result.payload?.skipped, "already_in_state");
  // The client's own payload is kept as it came.
  assert.equal((result.payload?.result as JsonObject).skipped, "already_in_state");
});

test("an ordinary press, another word, or a failed result puts no skip on the dispatch payload", async () => {
  for (const [status, payload] of [
    ["succeeded", { status: "succeeded", actionType: "web.dom.click" }],
    ["succeeded", { status: "succeeded", skipped: "already_done" }],
    ["succeeded", { status: "succeeded", skipped: ["already_in_state"] }],
    ["failed", { status: "failed", skipped: "already_in_state" }],
    ["succeeded", undefined]
  ] as [string, JsonObject | undefined][]) {
    const result = await dispatchWith(status, payload);
    assert.equal(Object.hasOwn(result.payload ?? {}, "skipped"), false, JSON.stringify(payload));
  }
});
