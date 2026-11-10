// Where a node run's time goes (task speed S0): a press run under Core's step
// log writes its parts as spans of its step -- the look before, the act, the
// look after, each command sent and the page's own share of it, and the
// sanitize after each look -- and a run with the step log off times nothing.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { automationStudioLlmStepLogSpans, automationStudioLlmStepLogTool } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownPageLines } from "../../../page-view/tests/shown-page-lines";
import { webNodeTiming } from "..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

type Span = { name: string; at: number; ms: number; detail?: string };

/** A page whose content script answers each command with its own start and end, as the extension's does. */
function gateway(): WebLlmEvidenceGateway {
  let presses = 0;
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      const startedAt = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 3));
      if (command.actionType === "web.dom.click") presses += 1;
      const snapshot = {
        url: "https://example.test/start", title: `Fixture ${presses}`, viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
        interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }, { tagName: "span", selector: "#status", visibleText: `Pressed ${presses} times` }]
      };
      const payload: JsonObject = command.actionType === "web.dom.capture_snapshot" ? { snapshot } : { value: "ok" };
      return { status: "succeeded", payload: { ...payload, startedAt, finishedAt: Date.now() } };
    }
  };
}

test("a press under the step log writes the look before, the act, the look after and each command's page share as spans", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "web-node-timing-"));
  try {
    const runtime = createWebAutomationLlmEvidenceRuntime(gateway());
    const run = automationStudioLlmStepLogTool((request: { callId: string; toolId: string; value: JsonObject }) => runtime.executeTool({ ...PROJECT, ...request }), { FLUXIQ_LLM_STEP_LOG_DIR: directory });
    const looked = await run({ callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
    const handle = shownPageLines(looked.evidence)[0]!.target;
    const pressed = await run({ callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
    assert.equal(pressed.resultCode, "web.action.succeeded");

    const [lookStep, pressStep] = readdirSync(directory).filter((name) => /^\d{4}-/u.test(name)).sort();
    const spansOf = (folder: string) => (JSON.parse(readFileSync(path.join(directory, folder, "meta.json"), "utf8")) as { spans: Span[] }).spans;
    assert.deepEqual(spansOf(lookStep!).map((span) => span.name).sort(), ["look", "page.capture_snapshot", "sanitize", "send.capture_snapshot"]);
    const spans = spansOf(pressStep!);
    const names = spans.map((span) => span.name);
    for (const name of ["look.before", "prepare", "permission", "act", "send.click", "page.click", "look.after", "press.settle", "compose"]) assert.ok(names.includes(name), `${name} in ${names.join(", ")}`);
    assert.equal(names.filter((name) => name === "send.capture_snapshot").length, 2, "one look before and one after");
    assert.deepEqual(spans.filter((span) => span.name === "sanitize").map((span) => span.detail), ["look.before", "look.after"]);
    // The page's share of the press lies inside the act, and the act after the look before.
    const at = (name: string) => spans.find((span) => span.name === name)!;
    assert.ok(at("page.click").at >= at("act").at && at("page.click").at + at("page.click").ms <= at("act").at + at("act").ms + 1);
    assert.ok(at("act").at >= at("look.before").at + at("look.before").ms - 1);
    assert.equal(at("send.click").detail, "succeeded");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("outside a step nothing is recorded, and the timed gateway answers exactly what the gateway answered", async () => {
  const inner = gateway();
  const timing = webNodeTiming(inner);
  const answer = await timing.gateway.executeAction("session.one", { actionType: "web.dom.click", parameters: {}, metadata: {} });
  assert.equal(answer.status, "succeeded");
  assert.deepEqual(timing.gateway.eligibleSessionIds(), ["session.one"]);
  assert.equal("structureDetectionSessionIds" in timing.gateway, false, "a gateway without detection gains none");
  const collected = automationStudioLlmStepLogSpans.collect(() => timing.look("look", async () => {
    await timing.gateway.executeAction("session.one", { actionType: "web.dom.capture_snapshot", parameters: {}, metadata: {} });
    await new Promise((resolve) => setTimeout(resolve, 2));
  }));
  await collected.done;
  assert.deepEqual(collected.spans().map((span) => span.name).sort(), ["look", "page.capture_snapshot", "sanitize", "send.capture_snapshot"]);
});
