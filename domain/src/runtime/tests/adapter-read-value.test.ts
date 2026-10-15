// The runtime path a Flow run takes, for the single-value read (t646): the
// value the page read reaches Core where the read's `value` port says it lies,
// so Core fills `outputs.value` from it and a later step reads
// `$step.<label>.value` (Core `runtime/executor/node-execution/result-path-outputs.ts`).
// A value read off a sensitive control is not there, so the port stays empty.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationRuntimeAdapter } from "../adapter";

const readCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.read",
  outputId: "web.dom.extract",
  parameters: { selector: "#read-target", extract: { mode: "text" } }
};

/** The adapter driven against a fake FluxIQ whose client answers `payload`, keeping the command it was sent. */
async function runRead(payload: JsonObject): Promise<{ result: FluxIQRuntimeCommandResult; sent: JsonObject[] }> {
  const sent: JsonObject[] = [];
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.extract"] }]
          }]
        })
      },
      automationStudioClientGateway: {
        executeAction: async (_sessionId: string, command: JsonObject) => {
          sent.push(command);
          return { commandId: "client.command.read", status: "succeeded", message: "Value extracted.", payload };
        }
      }
    }
  } as unknown as FluxIQ;
  return { result: await createWebAutomationRuntimeAdapter({ fluxiq }).execute(readCommand, {}), sent };
}

function clientPayload(element: JsonObject, extracted: JsonValue): JsonObject {
  return {
    commandId: "client.command.read",
    actionType: "web.dom.extract",
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    element,
    extracted
  };
}

/** What Core reads for the read's value port: the value at its `resultPath` in the dispatched payload, or nothing. */
function valueOnPort(payload: JsonValue | undefined): JsonValue | undefined {
  const node = webAutomationOutputNodeDefinitions.find((definition) => definition.id === webAutomationOutputNodeId("web.dom.extract"));
  const port = node?.outputs.find((candidate) => candidate.id === "value");
  assert.ok(port?.resultPath, "the read declares where its value lies");
  let current: JsonValue | undefined = payload;
  for (const segment of port.resultPath.split(".")) {
    current = current && typeof current === "object" && !Array.isArray(current) && Object.hasOwn(current, segment) ? current[segment] : undefined;
  }
  return current;
}

test("the value an ordinary element's read returned lies where the read's value port says, and the read was sent its mode", async () => {
  const { result, sent } = await runRead(clientPayload({ selector: "#read-target", tagName: "span" }, "Order 4471"));
  assert.equal(result.status, "succeeded");
  assert.equal(valueOnPort(result.payload), "Order 4471");
  assert.deepEqual((sent[0]?.parameters as JsonObject | undefined)?.extract, { mode: "text" }, "the read's mode reaches the client");
});

test("a value read off a sensitive control is not where the value port reads, so the port stays empty", async () => {
  const sensitive = { selector: "[data-testid=\"payment\"]", tagName: "input", inputType: "text", attributes: { autocomplete: "billing cc-number" } };
  const { result } = await runRead(clientPayload(sensitive, "SENTINEL-READ-OFF-A-SENSITIVE-CONTROL"));
  assert.equal(valueOnPort(result.payload), undefined);
  assert.equal(JSON.stringify(result).includes("SENTINEL-READ-OFF-A-SENSITIVE-CONTROL"), false);
});
