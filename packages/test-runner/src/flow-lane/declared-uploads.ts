import { webAutomationRecordedElementKey, webAutomationUploadBindingPath, webAutomationUploadStatePath, type WebAutomationUploadFile, type WebAutomationUploadRequest } from "@fluxiq-web-extension/domain/node";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { deterministicUploadBytes } from "../trusted-input/index.js";
import type { FlowNodeRecord } from "./flow-action-types.js";

/**
 * A node of the approved Flow that asks the run for files, read off the node:
 * which node, the run-input path it asks under, and the path the domain derives
 * from the control the node was recorded on. The two paths agree for every node
 * the domain wrote. The second is kept so the runner proves that rather than
 * trusting it. Neither holds a file.
 */
export type FlowUploadRequest = { nodeId: string; path: string; recordedElementPath: string | undefined };

/**
 * The media type a supplied file declares. The recording lane hands the browser
 * a file by path, and the browser types it from its extension. Nothing the Flow
 * is judged on reads the type: the fixture records a file's name and size. So
 * the runner declares the generic binary type rather than keep a second table of
 * extensions.
 */
const DECLARED_UPLOAD_MIME_TYPE = "application/octet-stream";

/**
 * Every request the approved Flow's nodes make for files, from the nodes
 * `readFlowNodes` read. A recorded node keeps its output payload under
 * `parameterValues.parameters`, and a file choice's `upload` there is
 * `{ $state: { path: "web.upload.<key>" } }`
 * (`domain/src/output-nodes/upload-binding.ts`). The domain's reader recognises
 * a request, and the domain's key rule names the recorded control, so this
 * module restates neither.
 */
export function flowUploadRequests(nodes: readonly FlowNodeRecord[]): FlowUploadRequest[] {
  return nodes.flatMap((node) => {
    const parameters = optionalRecord(node.parameterValues?.parameters);
    const path = webAutomationUploadBindingPath(parameters?.upload);
    if (!parameters || path === undefined) return [];
    const key = webAutomationRecordedElementKey(parameters as Parameters<typeof webAutomationRecordedElementKey>[0]);
    return [{ nodeId: node.id, path, recordedElementPath: key === undefined ? undefined : webAutomationUploadStatePath(key) }];
  });
}

/**
 * The run inputs that answer the Flow's requests for files. Under each path a
 * node asks for, it puts the file the recording script's `upload` steps name,
 * with the bytes `deterministicUploadBytes` gives that name. Those are the bytes
 * the recording lane wrote and handed the browser
 * (`trusted-input/upload-file.ts`).
 *
 * No step is paired with a request by guessing. While every `upload` step names
 * the same file, each request gets that file, which covers every scenario today
 * (W17 has one step). Steps naming different files would each need pairing with
 * the control they were recorded on. This module does not do that, so such a
 * script fails the run before it starts rather than put a file in the wrong
 * control.
 *
 * The run fails before the Flow starts in two more cases. Each failure names
 * node ids, steps and paths, never a file's name or content:
 * - a request whose path is not the one the domain derives from its recorded
 *   control. An input keyed any other way would answer nothing, and Core would
 *   fail the node for the request left unanswered.
 * - a request when no `upload` step names a file, because nothing the scenario
 *   declares says what that control should hold.
 *
 * A script with an `upload` step and no request supplies nothing. The recording
 * then produced no upload node, which is a product result for the workflow's
 * pinned `web.dom.upload` to judge, not a fixture defect.
 */
export function declaredUploadInputs(input: {
  scenarioId: string;
  steps: readonly ScenarioStep[];
  requests: readonly FlowUploadRequest[];
}): Record<string, WebAutomationUploadRequest> {
  if (!input.requests.length) return {};
  const unkeyed = input.requests.filter((request) => request.recordedElementPath !== request.path);
  if (unkeyed.length) {
    throw new RunnerFailure("recording.contract", `Scenario ${input.scenarioId}: a Flow node asks for files under a path other than the one the domain derives from the control it was recorded on. ${unkeyed.map((request) => `Node ${request.nodeId} asks under ${request.path}; its recorded control is keyed ${request.recordedElementPath ?? "by nothing"}.`).join(" ")}`, {
      details: { scenarioId: input.scenarioId, requests: unkeyed.map((request) => ({ nodeId: request.nodeId, path: request.path, recordedElementPath: request.recordedElementPath ?? null })) },
    });
  }
  const paths = [...new Set(input.requests.map((request) => request.path))];
  const uploadSteps = input.steps.filter((step) => step.operation === "upload");
  const fileNames = [...new Set(uploadSteps.map((step) => step.value))];
  const fileName = fileNames.length === 1 && typeof fileNames[0] === "string" && fileNames[0] ? fileNames[0] : undefined;
  if (fileName === undefined) {
    const stepIds = uploadSteps.map((step) => step.id);
    throw new RunnerFailure("fixture.invalid", `Scenario ${input.scenarioId}: the Flow asks for files under ${paths.join(", ")}, and the recording script's upload steps (${stepIds.join(", ") || "none"}) do not name one file to supply.`, {
      details: { scenarioId: input.scenarioId, paths, nodeIds: [...new Set(input.requests.map((request) => request.nodeId))], uploadSteps: stepIds },
    });
  }
  return Object.fromEntries(paths.map((path) => [path, { files: [declaredUploadFile(fileName)] }]));
}

/** The file an `upload` step names, in the form the Flow's upload takes. */
function declaredUploadFile(name: string): WebAutomationUploadFile {
  return { name, mimeType: DECLARED_UPLOAD_MIME_TYPE, contentBase64: deterministicUploadBytes(name).toString("base64") };
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
