// `web.find_on_page` run against the live page (t223).
//
// A fresh capture that also lists what is not rendered (`includeHidden`), so a
// closed menu's items and a collapsed panel's words can be found. It is
// restamped and kept like any look the model's handles are bound through, so a
// handle a search prints is one a press can use; a hidden element never moves a
// visible one's handle (`../stable-handles.ts`), and the state digest leaves
// hidden elements out, so a search reads as the same state as a look.

import type { JsonValue } from "fluxiq/core";
import {
  captureEvidence,
  toolExecution,
  withCallStates,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { WEB_LLM_INSPECT_RESULT_CODE } from "../vocabulary";
import { webLlmFindOnPage } from "./search";
import { webLlmFindQuery } from "./query";

export type WebFindOnPageRun = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  /** Stable handles, and the runtime's retention, as every authoring capture gets them. */
  restamp: (binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
  /** Kept as a look: its handles join the page's, so a press can bind one. */
  looked: (binding: WebLlmSnapshotBinding) => void;
};

/** Search the page the build stands on; it only observes. */
export async function runWebFindOnPage(run: WebFindOnPageRun): Promise<WebLlmEvidenceToolExecution> {
  const { query, after } = webLlmFindQuery(run.request.value);
  const page = run.restamp(await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal, undefined, { includeHidden: true }));
  run.looked(page);
  const found = webLlmFindOnPage(page.evidence, query, after);
  return withCallStates(toolExecution(found as unknown as JsonValue, false, WEB_LLM_INSPECT_RESULT_CODE), page, page);
}
