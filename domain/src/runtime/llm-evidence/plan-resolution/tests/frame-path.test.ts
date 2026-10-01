// A step built inside a child frame names that frame by the path of its
// document as well as by its id (t195 C1, apply-quillmark).
//
// Quillmark's careers page embeds its application form from the Lab's other
// loopback port. The dry run and playback open a new tab, Chrome numbers the
// frame afresh, and a step that named only the frame id it was built in named
// nothing: every form step failed "addressed to frame 7, which this tab does
// not have". A recorded node already carried the frame's path
// (`output-nodes/payloads.ts`); these rows hold a model-built one to the same:
//
// - a click on an element shown inside the frame dispatches `browserFrameId`
//   and `browserFrameUrlPath`, the pathname only of the frame document the
//   element was shown in -- no origin, no query;
// - a top-frame element gets no path;
// - a list detected in that frame keeps the path on its handle, and the extract
//   node resolved from the handle carries it beside the frame id.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../..";
import { shownHandle } from "../../page-view/tests/shown-page-lines";
import { CAPTURED_DETECTIONS } from "../../structure/tests/captured-detections";

const TOP_URL = "http://127.0.0.1:4173/scenarios/job-board/careers/quillmark/jobs/QM-4471";
/** Served from the Lab's other loopback port, with a query that carries a token, as the scenario's embed is. */
const FRAME_URL = "http://127.0.0.1:4999/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471";
/** The scenario's `EMBED_ROOT + "/job_app"`. */
const FRAME_PATH = "/scenarios/job-board/embed/job_app";
const FRAME_ID = 7;
const SCOPE = { projectId: "project.one", flowId: "flow.one" };

const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");

/** An element the frame merge took in from frame 7, stamped as it stamps one. */
function framed(selector: string, name: string, tagName: string): JsonObject {
  return {
    tagName,
    selector: `frame[${FRAME_ID}] >> ${selector}`,
    accessibleName: name,
    visibleText: name,
    attributes: { "data-fluxiq-frame-id": String(FRAME_ID), "data-fluxiq-frame-url": FRAME_URL }
  };
}

const ACCEPT: JsonObject = { tagName: "button", selector: "#accept", accessibleName: "Accept cookies", visibleText: "Accept cookies" };
const SUBMIT = framed("form > button.tl-submit", "Submit application", "button");
const REFERENCE = framed("dl > dd:nth-of-type(3)", "TL-ABCD-EFGH", "dd");

/** What the frame's page proposes around the reference: a detection the real content script produced. */
const STRUCTURE = CAPTURED_DETECTIONS["data-table-largest"].structure as JsonValue;

type Command = { actionType: string; parameters: JsonObject };

/**
 * The careers page: a merged look of the top document and frame 7, and frame
 * 7's own document -- at the frame's address, with its elements unprefixed --
 * when a capture is addressed to the frame.
 */
function careersPage(): { runtime: WebAutomationLlmEvidenceRuntime; commands: Command[] } {
  const commands: Command[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: structuredClone(command.parameters) });
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const inFrame = command.parameters.browserFrameId === FRAME_ID;
      const snapshot: JsonObject = inFrame
        ? { url: FRAME_URL, title: "Apply", interactiveElements: [SUBMIT, REFERENCE].map((element) => ({ tagName: element.tagName as string, selector: (element.selector as string).replace(/^frame\[\d+\] >> /u, ""), accessibleName: element.accessibleName as string, visibleText: element.visibleText as string })) }
        : { url: TOP_URL, title: "Careers", interactiveElements: [ACCEPT, SUBMIT, REFERENCE] };
      const payload: JsonObject = command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: STRUCTURE };
      return { status: "succeeded", payload };
    }
  });
  return { runtime, commands };
}

let calls = 0;
async function runNode(runtime: WebAutomationLlmEvidenceRuntime, node: string, parameters: JsonObject) {
  calls += 1;
  return await runtime.executeTool({ ...SCOPE, callId: `call.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

/** The look the model is shown, from which a test reads the handle it gave an element by its words. */
async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<unknown> {
  return (await runNode(runtime, "web.output.dom-capture_snapshot", {})).evidence;
}

function handleFor(shown: unknown, words: string): string {
  return shownHandle(shown, words);
}

test("a click on an element shown in a child frame names the frame by its document's path as well as its id", async () => {
  const { runtime, commands } = careersPage();
  const handles = await look(runtime);
  commands.length = 0;
  await runNode(runtime, "web.output.dom-click", { target: { handle: handleFor(handles, "Submit application") } });
  const click = commands.find((command) => command.actionType === "web.dom.click");
  assert.ok(click !== undefined, "the click was dispatched");
  assert.equal(click.parameters.selector, "form > button.tl-submit");
  assert.equal(click.parameters.browserFrameId, FRAME_ID);
  assert.equal(click.parameters.browserFrameUrlPath, FRAME_PATH, "the pathname only: no origin, no query");

  // The same holds for a step of the Flow, resolved from the plan.
  const resolved = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle: handleFor(handles, "Submit application") } }, declaredConsequences: [] });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.status === "resolved" && resolved.parameters.browserFrameUrlPath, FRAME_PATH);
});

test("a click on a top-frame element names no frame and no path", async () => {
  const { runtime, commands } = careersPage();
  const handles = await look(runtime);
  commands.length = 0;
  await runNode(runtime, "web.output.dom-click", { target: { handle: handleFor(handles, "Accept cookies") } });
  const click = commands.find((command) => command.actionType === "web.dom.click");
  assert.ok(click !== undefined, "the click was dispatched");
  assert.equal(click.parameters.selector, "#accept");
  assert.equal("browserFrameId" in click.parameters, false);
  assert.equal("browserFrameUrlPath" in click.parameters, false);
});

test("a list detected in a child frame keeps the frame's path, and the extract node built from it carries it", async () => {
  const { runtime, commands } = careersPage();
  const handles = await look(runtime);
  commands.length = 0;
  const detected = await runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: { target: handleFor(handles, "TL-ABCD-EFGH") } });
  assert.equal(detected.resultCode, WEB_LLM_STRUCTURE_RESULT_CODE);
  assert.deepEqual(commands.map((command) => [command.actionType, command.parameters.browserFrameId ?? null]), [
    ["web.dom.capture_snapshot", null],
    ["web.dom.capture_snapshot", FRAME_ID]
  ]);
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const binding = runtime.resolveExtractionHandle({ ...SCOPE, handle });
  assert.ok(binding.ok);
  assert.equal(binding.binding.frameId, FRAME_ID);
  assert.equal(binding.binding.frameUrlPath, FRAME_PATH);

  const resolved = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_LIST_NODE, parameters: { extractList: { handle } }, declaredConsequences: [] });
  assert.equal(resolved.status, "resolved");
  if (resolved.status !== "resolved") return;
  assert.equal(resolved.parameters.browserFrameId, FRAME_ID);
  assert.equal(resolved.parameters.browserFrameUrlPath, FRAME_PATH);
});
