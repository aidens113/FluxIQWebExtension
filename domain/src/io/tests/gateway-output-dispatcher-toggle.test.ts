// A Flow's press in a trial that flipped its own control says so (t787): the
// click verb reports the raw signature on its result, and the dispatcher lifts
// it to the top of the dispatch payload, which Core keeps as the attempt's
// `outputs.result` and reads `toggle` from (Core
// `flow-bootstrap/explored-toggles.ts`), as it reads `skipped`. It is told as an
// explored press's toggle is: the signature, and `web.output.dom-check` for a
// control that states its state (`actions/toggle-signature/output.ts`).

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
  return await dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.click", payload: { selector: "#toggle" } });
}

test("a press that flipped its control's name says its toggle at the top of the dispatch payload", async () => {
  const signature = { via: "name", gains: ["unlike"], loses: ["like"] };
  const result = await dispatchWith("succeeded", { status: "succeeded", actionType: "web.dom.click", toggle: signature });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload?.toggle, { signature });
  // The client's own payload is kept as it came.
  assert.deepEqual((result.payload?.result as JsonObject).toggle, signature);
});

test("a press that flipped a stated state names the node that sets that state, as an explored press does", async () => {
  const signature = { via: "attribute", attribute: "aria-pressed", to: true };
  const result = await dispatchWith("succeeded", { status: "succeeded", actionType: "web.dom.click", toggle: signature });
  assert.deepEqual(result.payload?.toggle, { signature, idempotentWith: "web.output.dom-check" });
});

test("a failed press, a skipped one, a malformed signature or none puts no toggle on the dispatch payload", async () => {
  const signature = { via: "name", gains: ["unlike"], loses: ["like"] };
  for (const [status, payload] of [
    ["failed", { status: "failed", toggle: signature }],
    ["succeeded", { status: "succeeded", skipped: "already_in_state", toggle: signature }],
    ["succeeded", { status: "succeeded", toggle: { via: "name", gains: [], loses: [] } }],
    ["succeeded", { status: "succeeded", toggle: { via: "name", gains: ["unlike"], loses: ["like"], page: "words" } }],
    ["succeeded", { status: "succeeded", toggle: "unlike" }],
    ["succeeded", { status: "succeeded", actionType: "web.dom.click" }],
    ["succeeded", undefined]
  ] as [string, JsonObject | undefined][]) {
    const result = await dispatchWith(status, payload);
    assert.equal(Object.hasOwn(result.payload ?? {}, "toggle"), false, JSON.stringify(payload));
  }
});
