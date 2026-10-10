// A command the browser lost in flight reaches the dispatcher as a result whose
// payload says `interrupted` (plan B3). The dispatcher decides its status and
// record again from the command it sent: a committing act is an `unknown`
// outcome carrying an `ambiguous` record, which Core holds as uncertain; any
// other act is a failure stated `unacted`, which Core may make again.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ, OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { webAutomationInterruptedActionResult } from "../../client/interrupted-action";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";

async function dispatchAnswered(outputId: string, payload: JsonObject, clientCommitting: boolean): Promise<OutputDispatchResult<JsonObject>> {
  const answer = webAutomationInterruptedActionResult({ commandId: "cmd-1", actionType: outputId, committing: clientCommitting, startedAt: 1 }, 2);
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{ sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension", capabilities: [{ id: "web.actions", actionTypes: [outputId] }] }]
        })
      },
      automationStudioClientGateway: { executeAction: async () => answer }
    }
  } as unknown as FluxIQ;
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId, payload });
}

test("an interrupted press reaches Core as an uncertain outcome", async () => {
  const result = await dispatchAnswered("web.dom.click", { selector: "#add" }, true);
  assert.equal(result.ok, false);
  assert.equal(result.status, "unknown");
  assert.equal(result.failure?.effect, "ambiguous");
  assert.equal((result.payload?.result as JsonObject).status, "interrupted");
});

test("an interrupted non-committing act reaches Core as an unacted failure", async () => {
  const result = await dispatchAnswered("web.dom.type", { selector: "#qty", text: "2" }, false);
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.effect, "unacted");
  assert.equal(result.failure?.retryable, true);
});

test("the dispatcher's own reading of the command wins over the client's", async () => {
  // A submitting type commits whatever the client recorded about it.
  const result = await dispatchAnswered("web.dom.type", { selector: "#q", text: "kettle", submit: true }, false);
  assert.equal(result.status, "unknown");
  assert.equal(result.failure?.effect, "ambiguous");
});
