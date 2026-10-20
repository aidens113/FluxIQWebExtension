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
// Every Core evidence loop opens with one free look at the page, which Core's
// frame marks as its opening of the round, fresh or continuing
// (`AS/runtime/llm/harness-options/evidence-build-scope.ts`, t728). That call
// is where this domain starts counting again. Inside one loop a genuine repeat
// is still said, exactly as `extraction-failure-detail.test.ts` pins it.

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../tools";
import { WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../vocabulary";

const SCOPE = { projectId: "project.store", flowId: "flow.earbuds" } as const;
/** How Core frames a call: its opening of a round, if it is one, and the brief it runs under beside others. */
type Frame = { opening?: "fresh" | "continuing"; callScope?: string };

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

/** A call as Core's registry runs it, inside the build's frame. */
async function exec(runtime: Runtime, input: Parameters<Runtime["executeTool"]>[0], frame: Frame = {}) {
  return await runWithAutomationStudioEvidenceBuildScope({ ...SCOPE, buildId: "build.one", ...frame }, () => runtime.executeTool(input));
}

/** The free first look a Core evidence loop opens with, marked as Core marks it. */
async function openLoop(runtime: Runtime, frame: Frame = {}) {
  const look = await exec(runtime, { ...SCOPE, callId: "call.opening", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } }, { opening: "fresh", ...frame });
  assert.equal(look.resultCode, "web.inspect.succeeded");
}

async function detect(runtime: Runtime, callId: string, frame: Frame = {}) {
  return await exec(runtime, { ...SCOPE, callId, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }, frame);
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

test("a call Core did not mark as its opening is not one, whatever its id says", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(barePage());
  await openLoop(runtime);
  await detect(runtime, "call.detect");
  // Only Core's frame says a call opens a round (t728); no id a call carries does.
  for (const callId of [`initial.${WEB_LLM_DETECT_STRUCTURE_TOOL_ID}`, `initial.${WEB_LLM_RUN_NODE_TOOL_ID}`]) {
    const named = await detect(runtime, callId);
    assert.equal(named.resultReason, "answered_the_same_again", callId);
  }
});

test("a re-author whose draft holds the Flow opens a new conversation too", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(barePage());
  await openLoop(runtime);
  await detect(runtime, "call.detect");
  assert.equal((await detect(runtime, "call.detect.again")).resultReason, "answered_the_same_again");

  await openLoop(runtime, { opening: "continuing" });
  assert.equal((await detect(runtime, "call.detect")).resultReason, "nothing_repeats_on_page");
});

// Before t728 only the unscoped opening id `initial.<toolId>` let go of the
// count, so a brief run beside others -- whose opening id carries its scope --
// was told its first answer repeated what the brief before it had heard.
test("a brief run beside others starts over at its own opening, and leaves every other brief's count alone (t728)", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(barePage());
  const one = { callScope: "brief-1" };
  const two = { callScope: "brief-2" };
  await openLoop(runtime, one);
  await openLoop(runtime, two);
  await detect(runtime, "call.detect", one);
  await detect(runtime, "call.detect", two);
  assert.equal((await detect(runtime, "call.detect.again", one)).resultReason, "answered_the_same_again");

  // Brief 1 opens a new round: its model has heard nothing; brief 2's still has.
  await openLoop(runtime, one);
  assert.equal((await detect(runtime, "call.detect", one)).resultReason, "nothing_repeats_on_page");
  assert.equal((await detect(runtime, "call.detect.again", two)).resultReason, "answered_the_same_again");
});
