// A repeated refusal is a repeat to the model that heard the first one, and to
// nobody else.
//
// The run this pins is `run-munnhi5q-4867dabe`, 2026-09-29. Its build's last
// look for a list was refused `nothing_repeats_on_page`. The Flow then ran, its
// answer was refuted, and the re-author -- a new evidence loop, with a new model
// conversation that had heard nothing -- asked the same tool on the page the run
// ended on. Its very first answer came back `answered_the_same_again`,
// `repeatedAnswer: 2`: the domain's memory of the build's last answer had
// outlived the build, so the re-author was told it had already been told
// something it had never seen.
//
// Every Core evidence loop opens with one free look at the page, filed under
// the call id `initial.<toolId>` (`AS/runtime/llm/evidence-loop.ts`). That call
// is where this domain starts counting again. Inside one loop a genuine repeat
// is still said, exactly as `extraction-failure-detail.test.ts` pins it.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

const SCOPE = { projectId: "project.store", flowId: "flow.earbuds" } as const;
const OPENING_LOOK = `initial.${WEB_LLM_RUN_NODE_TOOL_ID}`;

/** A results page whose detection finds nothing that repeats, every time it is asked. */
function barePage(): WebLlmEvidenceGateway {
  const elements: JsonObject[] = ["Search", "Filter", "Sort", "Help"].map((name) => ({ tagName: "button", selector: `#${name.toLowerCase()}`, accessibleName: name }));
  return {
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      const snapshot: JsonObject = { url: "https://everything-store.test/s?k=earbuds&page=4", title: "Results", interactiveElements: elements, elementTotal: 9 };
      if (command.parameters.detectStructure === undefined) return { status: "succeeded", payload: { snapshot } };
      return { status: "succeeded", payload: { snapshot, structure: { ok: false, refused: "no_repeating_run" } } };
    }
  };
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

/** The free first look a Core evidence loop opens with, under the id Core files it under. */
async function openLoop(runtime: Runtime) {
  const look = await runtime.executeTool({ ...SCOPE, callId: OPENING_LOOK, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  assert.equal(look.resultCode, "web.inspect.succeeded");
}

async function detect(runtime: Runtime, callId: string) {
  return await runtime.executeTool({ ...SCOPE, callId, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
}

function detail(execution: { evidence: unknown }): JsonObject | undefined {
  return (execution.evidence as { detail?: JsonObject }).detail;
}

test("a new exploration's first refusal is its first, however the last exploration ended", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(barePage());

  // The build: the same question twice in one conversation is a repeat, and says so.
  await openLoop(runtime);
  const buildFirst = await detect(runtime, "call.detect");
  assert.equal(buildFirst.resultReason, "nothing_repeats_on_page");
  const buildAgain = await detect(runtime, "call.detect.again");
  assert.equal(buildAgain.resultReason, "answered_the_same_again");
  assert.equal(detail(buildAgain)?.repeatedAnswer, 2);

  // The re-author: a new loop on the same page, project, Flow and session. Its
  // model has heard nothing yet, so the answer is the cause, not a count.
  await openLoop(runtime);
  const reauthorFirst = await detect(runtime, "call.detect");
  assert.equal(reauthorFirst.resultReason, "nothing_repeats_on_page");
  assert.equal(detail(reauthorFirst)?.repeatedAnswer, undefined);
  assert.equal(detail(reauthorFirst)?.reason, "nothing_repeats_on_page");

  // And inside the re-author a genuine repeat is still one.
  const reauthorAgain = await detect(runtime, "call.detect.again");
  assert.equal(reauthorAgain.resultReason, "answered_the_same_again");
  assert.equal(detail(reauthorAgain)?.repeatedAnswer, 2);
});

test("a call the model named like the opening look is not one when the loop already made it", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(barePage());
  await openLoop(runtime);
  await detect(runtime, "call.detect");
  // Core suffixes a reused id (`evidence-loop/call-id.ts`), so a model's own
  // call can only carry the opening id when no opening look was taken; a
  // detection is never the opening look whatever its id says.
  const named = await runtime.executeTool({ ...SCOPE, callId: `initial.${WEB_LLM_DETECT_STRUCTURE_TOOL_ID}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(named.resultReason, "answered_the_same_again");
  assert.equal(detail(named)?.repeatedAnswer, 2);
});
