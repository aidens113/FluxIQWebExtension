// T1 for Phase 1.2 step 5 on the IO path. Core's `dispatchPolicyOutput` reads
// three fields of a dispatch result: `status` (which `failureForCommandStatus`
// classifies), `failure` (a host-reported record wins over Core's own
// inference), and `error` (the node result's message, since that path never
// looks at the payload). So the command's status and structured failure are
// forwarded, and a failure the client described only in `message` is promoted
// into `error` rather than arriving reasonless. `ok` stays the success flag.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { dispatchWebAutomationOutput } from "../gateway-output-dispatcher";

type GatewayActionResult = {
  commandId: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled" | "unknown";
  message?: string;
  error?: string;
  payload?: JsonObject;
  failure?: AutomationStudioFailureRecord;
};

const readySession = {
  sessionId: "session.one",
  clientId: "client.one",
  status: "ready",
  clientType: "extension",
  capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"] }]
};

const dispatchRequest = {
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  outputId: "web.dom.click",
  payload: { selector: "#save" } as JsonObject
};

const executed: Array<{ sessionId: string; actionType: string; parameters?: JsonObject }> = [];

function dispatch(
  answer: GatewayActionResult | (() => never),
  sessions: unknown[] = [readySession]
): ReturnType<typeof dispatchWebAutomationOutput> {
  const fluxiq = {
    programs: {
      clientGateway: { snapshot: () => ({ sessions }) },
      automationStudioClientGateway: {
        executeAction: async (sessionId: string, command: { actionType: string; parameters?: JsonObject }) => {
          executed.push({ sessionId, actionType: command.actionType, ...(command.parameters ? { parameters: command.parameters } : {}) });
          return typeof answer === "function" ? answer() : answer;
        }
      }
    }
  } as unknown as FluxIQ;
  return dispatchWebAutomationOutput(fluxiq, dispatchRequest);
}

test("a succeeded command dispatches to the paired client and reports ok with its status", async () => {
  executed.length = 0;
  const result = await dispatch({ commandId: "client.command.one", status: "succeeded", message: "Clicked Save.", payload: { clicked: true } });
  assert.deepEqual(executed, [{ sessionId: "session.one", actionType: "web.dom.click", parameters: { selector: "#save" } }]);
  assert.equal(result.ok, true);
  assert.equal(result.status, "succeeded");
  assert.equal(result.error, undefined, "a success never gains an error");
  assert.deepEqual(result.payload, { status: "succeeded", message: "Clicked Save.", result: { clicked: true } });
});

test("a timed out command keeps its status and promotes its message into the reason Core reads", async () => {
  const result = await dispatch({ commandId: "client.command.two", status: "timed_out", message: "The element never became visible." });
  assert.equal(result.ok, false);
  assert.equal(result.status, "timed_out", "Core maps this to its timeout category; `failed` would have hidden it");
  assert.equal(result.error, "The element never became visible.");
  assert.deepEqual(result.payload, { status: "timed_out", message: "The element never became visible." });
});

test("a cancelled command keeps its status and invents no reason when the client gave none", async () => {
  const result = await dispatch({ commandId: "client.command.three", status: "cancelled" });
  assert.equal(result.ok, false);
  assert.equal(result.status, "cancelled");
  assert.equal(result.error, undefined);
});

test("an explicit error outranks the message", async () => {
  const result = await dispatch({
    commandId: "client.command.four",
    status: "failed",
    error: "No element matches #save.",
    message: "Click failed."
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "failed");
  assert.equal(result.error, "No element matches #save.");
  assert.deepEqual(result.payload, { status: "failed", message: "Click failed." });
});

test("the client's structured failure record is forwarded for Core to parse", async () => {
  // The plan's ACTION_REJECTED is Core's `blocked_by_capability_or_policy`,
  // the category the content script's own rejections already carry
  // (`content/action-runtime/validation-outcome.ts`).
  const failure: AutomationStudioFailureRecord = {
    category: "blocked_by_capability_or_policy",
    code: "web.action.disabled",
    retryable: false
  };
  const result = await dispatch({ commandId: "client.command.five", status: "failed", message: "The button is disabled.", failure });
  assert.deepEqual(result.failure, failure);
  assert.equal(result.error, "The button is disabled.");
});

test("no eligible client is a domain-side refusal, not a command status", async () => {
  executed.length = 0;
  const result = await dispatch({ commandId: "client.command.six", status: "succeeded" }, []);
  assert.deepEqual(executed, [], "nothing is dispatched when no single client can be selected");
  assert.equal(result.ok, false);
  assert.equal(result.status, undefined);
  assert.match(result.error ?? "", /single paired web-automation client/u);
});

test("a gateway that throws fails with the thrown reason and no status", async () => {
  const result = await dispatch(() => { throw new Error("The websocket closed."); });
  assert.equal(result.ok, false);
  assert.equal(result.status, undefined);
  assert.equal(result.error, "The websocket closed.");
});
