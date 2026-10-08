// A failed text wait reaches Core with its sighting of the text (t369):
// `textPresence` and `visibleNear` on the failed command's
// `metadata.failureDiagnostics`, and beside the rest of the client's result
// under `payload.result`. Never on the failure record, whose parser drops an
// unknown key and the failure with it. A snippet the secret screen would change
// is dropped on both, and a wait that succeeds carries nothing new.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";

const waitCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.wait",
  outputId: "web.dom.wait_for_text",
  parameters: { text: "Cart (3)" }
};

const CARD = "Card 4111 1111 1111 1111 on file";

async function runWait(payload: JsonObject, status = "timed_out"): Promise<FluxIQRuntimeCommandResult> {
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.wait_for_text"] }]
          }]
        })
      },
      automationStudioClientGateway: {
        executeAction: async () => ({
          commandId: "client.command.wait",
          status,
          payload,
          ...(status === "succeeded" ? {} : { failure: { category: "timeout", code: "web.action.timeout", retryable: true, stage: "execution", expected: "page text containing Cart (3)", actual: "the text did not appear before the timeout" } })
        })
      }
    }
  } as unknown as FluxIQ;
  return await createWebAutomationRuntimeAdapter({ fluxiq }).execute(waitCommand, {});
}

function clientPayload(extra: JsonObject = {}, status = "timed_out"): JsonObject {
  return {
    commandId: "client.command.wait",
    actionType: "web.dom.wait_for_text",
    status,
    url: "https://shop.example/cart",
    title: "Cart",
    validation: { status: status === "succeeded" ? "passed" : "failed", expected: "page text containing Cart (3)", actual: "the text did not appear before the timeout" },
    ...extra
  };
}

function diagnostics(result: FluxIQRuntimeCommandResult): JsonObject {
  return (result.metadata as JsonObject).failureDiagnostics as JsonObject;
}

function clientResult(result: FluxIQRuntimeCommandResult): JsonObject {
  return (result.payload as JsonObject).result as JsonObject;
}

test("a text held only in a hidden flyout reaches Core as hidden, with the shown text near it", async () => {
  const result = await runWait(clientPayload({ textPresence: "hidden", visibleNear: ["Cart", "View cart"] }));
  assert.equal(result.status, "timed_out");
  assert.equal(diagnostics(result).textPresence, "hidden");
  assert.deepEqual(diagnostics(result).visibleNear, ["Cart", "View cart"]);
  assert.equal(clientResult(result).textPresence, "hidden");
  assert.deepEqual(clientResult(result).visibleNear, ["Cart", "View cart"]);
  // The record stays exactly what Core's parser accepts.
  assert.notEqual(parseAutomationStudioFailureRecord(result.failure), null);
  assert.equal("textPresence" in (result.failure ?? {}), false);
});

test("a text the page does not hold reaches Core as absent", async () => {
  const result = await runWait(clientPayload({ textPresence: "absent", visibleNear: [] }));
  assert.equal(diagnostics(result).textPresence, "absent");
  assert.deepEqual(diagnostics(result).visibleNear, []);
});

test("a snippet shaped like a secret never reaches Core, in the diagnostics or the payload", async () => {
  const result = await runWait(clientPayload({ textPresence: "hidden", visibleNear: [CARD, "Cart"] }));
  assert.deepEqual(diagnostics(result).visibleNear, ["Cart"]);
  assert.deepEqual(clientResult(result).visibleNear, ["Cart"]);
  assert.equal(JSON.stringify(result).includes("4111"), false);
});

test("a malformed sighting is dropped from the payload, and a wait without one carries neither key", async () => {
  const malformed = await runWait(clientPayload({ textPresence: "maybe", visibleNear: ["Cart"] }));
  assert.equal("textPresence" in clientResult(malformed), false);
  assert.equal("visibleNear" in clientResult(malformed), false);
  assert.equal("textPresence" in diagnostics(malformed), false);
  const plain = await runWait(clientPayload());
  assert.equal("textPresence" in diagnostics(plain), false);
  assert.equal("visibleNear" in clientResult(plain), false);
});

test("a wait that succeeds carries no failure diagnostics at all", async () => {
  const result = await runWait(clientPayload({}, "succeeded"), "succeeded");
  assert.equal(result.status, "succeeded");
  assert.equal("failureDiagnostics" in ((result.metadata ?? {}) as JsonObject), false);
});
