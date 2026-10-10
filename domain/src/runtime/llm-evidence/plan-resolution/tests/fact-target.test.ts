// A fact's `{ handle }` target, resolved the way a step's target is (t400).
//
// Core (the state-aware recovery plan, C9) resolves each fact target at
// bootstrap completion as a node with id `fluxiq.fact.target`, parameters
// `{ target: { handle } }`, declaring nothing lasting, and keeps the resolved
// parameters as the fact's durable target. What these rows prove:
// - the target resolves to the selector and element identity a click's would,
//   with the frame beside it when the element is in a child frame;
// - plain text resolves: a fact names a message or a heading as often as a
//   control, and no control, press or permission check applies to it;
// - an unknown handle is refused unknown, and a let-go one stale;
// - the resolved parameters, kept as the fact's target, read back through
//   `webAutomationFactQuery` as the `exists` claim the page is asked.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationFactQuery } from "../../../facts";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, type WebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID } from "../..";

/** Core's id for a fact target presented for resolution: the wire string, written here as Core sends it. */
const FACT_TARGET_NODE = "fluxiq.fact.target";
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");

const FORM_URL = "https://example.test/form";
const submit: JsonObject = { tagName: "button", selector: "#submit", visibleText: "Submit" };
const SUBMIT_IDENTITY: JsonObject = { tagName: "button", visibleText: "Submit", selector: "#submit" };
const message: JsonObject = { tagName: "p", selector: "#status > p", visibleText: "Your order was placed" };
const MESSAGE_IDENTITY: JsonObject = { tagName: "p", visibleText: "Your order was placed", selector: "#status > p" };

type Page = { url: string; elements: JsonObject[] };

/** A runtime whose page is whatever the test says it is now, answering every capture with it. */
function runtimeOver(page: () => Page): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const current = page();
      const snapshot: JsonObject = { url: current.url, title: "Fixture", interactiveElements: current.elements };
      return { status: "succeeded", payload: { snapshot } };
    }
  });
}

let calls = 0;
async function inspect(runtime: WebAutomationLlmEvidenceRuntime) {
  calls += 1;
  return await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: `call.inspect.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

/** What Core declares for a fact target: nothing lasting. */
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

async function resolve(runtime: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject) {
  return await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters, declaredConsequences: NOTHING_LASTING });
}

function refusedAt(reason: string, position: string) {
  return { status: "refused", issueCodes: [reason, `${reason}:${position}`] };
}

test("a fact target handle resolves to the selector and element identity a click's would", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [submit] }));
  await inspect(runtime);
  const fact = await resolve(runtime, FACT_TARGET_NODE, { target: { handle: "t1" } });
  assert.deepEqual(fact, { status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY } });
  assert.deepEqual(fact, await resolve(runtime, CLICK_NODE, { target: { handle: "t1" } }), "the same shape a click's resolved parameters take");
});

test("a fact target in a child frame names the frame and its path", async () => {
  const framed: JsonObject = { tagName: "button", selector: "frame[7] >> #submit", visibleText: "Submit", attributes: {
    "data-fluxiq-frame-id": "7", "data-fluxiq-frame-url": "https://example.test/embed/form?private=fixture"
  } };
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [framed] }));
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, FACT_TARGET_NODE, { target: { handle: "t1" } }), {
    status: "resolved", parameters: { selector: "#submit", element: SUBMIT_IDENTITY, browserFrameId: 7, browserFrameUrlPath: "/embed/form" }
  });
});

test("a fact target naming plain text resolves, with no permission asked and none needed", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [submit, message] }));
  await inspect(runtime);
  const permission = async () => {
    throw new Error("a fact target is never put to the permission gate");
  };
  for (const handleReach of [undefined, "view_history"] as const) {
    const resolved = await runtime.resolvePlanNodeParameters({
      projectId: "project.one", flowId: "flow.one", nodeDefinitionId: FACT_TARGET_NODE, parameters: { target: { handle: "t2" } },
      declaredConsequences: NOTHING_LASTING, permission, handleReach
    });
    assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
    assert.ok(resolved.status === "resolved");
    assert.equal(resolved.parameters.selector, "#status > p");
    assert.deepEqual(resolved.parameters.element, MESSAGE_IDENTITY);
  }
  // A candidate's press on the same words is what is held to naming a control.
  const press = await runtime.resolvePlanNodeParameters({
    projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK_NODE, parameters: { target: { handle: "t2" } },
    declaredConsequences: NOTHING_LASTING, handleReach: "view_history"
  });
  assert.equal(press.status, "refused", JSON.stringify(press));
});

test("an unknown fact target handle is refused unknown, and a let-go one stale", async () => {
  let page: Page = { url: FORM_URL, elements: [submit] };
  const runtime = runtimeOver(() => page);
  await inspect(runtime);
  assert.deepEqual(await resolve(runtime, FACT_TARGET_NODE, { target: { handle: "t99" } }), refusedAt("web.handle.unknown", "target"));
  for (let index = 0; index < 8; index += 1) {
    page = { url: `https://example.test/more/${index}`, elements: [{ tagName: "button", selector: "#other", visibleText: "Other" }] };
    await inspect(runtime);
  }
  assert.deepEqual(await resolve(runtime, FACT_TARGET_NODE, { target: { handle: "t1", location: FORM_URL } }), refusedAt("web.handle.stale", "target"));
});

test("the resolved parameters, kept as the fact's target, read back as an exists claim on that target", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [submit, message] }));
  await inspect(runtime);
  const resolved = await resolve(runtime, FACT_TARGET_NODE, { target: { handle: "t2" } });
  assert.ok(resolved.status === "resolved", JSON.stringify(resolved));
  const reading = webAutomationFactQuery({ fact: "exists", op: "exists", target: resolved.parameters });
  assert.ok("query" in reading, JSON.stringify(reading));
  assert.equal(reading.query.kind, "exists");
  assert.ok(reading.query.kind === "exists");
  assert.equal(reading.query.expected, true);
  assert.equal(reading.query.target.selector, "#status > p");
  assert.equal(reading.query.target.element?.tagName, "p");
  assert.equal(reading.query.target.element?.visibleText, "Your order was placed");
});
