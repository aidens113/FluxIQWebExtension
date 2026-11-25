// `web.describe_element` run against the live page (t223).
//
// `{"target": "tN"}`, `target.N` read as the `tN` it means. It takes a fresh
// capture that also lists what is not rendered, restamped and kept as a look,
// so a handle the full page printed for a hidden element can be described, and
// the handle means the same element it meant on the page the model read
// (`../stable-handles.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  captureEvidence,
  toolExecution,
  withCallStates,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { recoverable, rejectionDetail } from "../tool-rejection";
import { WEB_LLM_INSPECT_RESULT_CODE } from "../vocabulary";
import { webLlmDescribeElement } from "./description";

export type WebDescribeElementRun = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  /** Stable handles, and the runtime's retention, as every authoring capture gets them. */
  restamp: (binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
  /** Kept as a look: its handles join the page's, so a press can bind one. */
  looked: (binding: WebLlmSnapshotBinding) => void;
};

/** Describe one element of the page the build stands on; it only observes. */
export async function runWebDescribeElement(run: WebDescribeElementRun): Promise<WebLlmEvidenceToolExecution> {
  const handle = describedHandle(run.request.value);
  const page = run.restamp(await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal, undefined, { includeHidden: true }));
  run.looked(page);
  const described = webLlmDescribeElement(page.evidence, handle);
  return withCallStates(toolExecution(described as unknown as JsonValue, false, WEB_LLM_INSPECT_RESULT_CODE), page, page);
}

function describedHandle(value: JsonObject): string {
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "target")) refuse("unexpected_input_keys", undefined);
  if (!keys.includes("target")) refuse("missing_input_keys", undefined);
  const handle = canonicalWebLlmTargetHandle(value.target);
  if (handle === undefined) refuse("malformed_handle", typeof value.target === "string" ? value.target : undefined);
  return handle as string;
}

function refuse(reason: "unexpected_input_keys" | "missing_input_keys" | "malformed_handle", target: string | undefined): never {
  return recoverable("invalid_input", rejectionDetail({ reason, target, instead: reason === "malformed_handle" ? undefined : ["target"], missing: undefined, requestId: undefined }));
}
