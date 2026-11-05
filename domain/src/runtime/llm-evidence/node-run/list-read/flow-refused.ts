// Why a Flow would refuse a list read before reading anything (t869).
//
// A read by hand and a read replayed never asked this: the resolver only asks it of a step of a Flow being submitted
// (`webPlanUndispatchable`, `../../plan-resolution/`), and both send the read to the page themselves. So paid run
// `run-mw37vz9n-a77a02c2` read a list by hand with `dedupe` and an intermediate record output, which the Flow's dispatch
// refuses (`output-nodes/extract-list/dispatch.ts`). The replay read it too and answered no rows, since rows come from
// that same dispatch, and so its loop had nothing to walk and nobody was told why. The read is now refused where it is
// written, with the dispatch's own codes, and a replay of one already written says so instead of answering nothing.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListDispatch } from "../../../../output-nodes";
import { isJsonRecord } from "../../untrusted-json";

const EXTRACT_LIST_ACTION = "web.dom.extract_list";

/** The dispatch's codes for why this node's call would be refused in a Flow, or nothing when it is no list read or would run. */
export function webListReadFlowRefused(actionType: string, parameters: JsonObject): string[] | undefined {
  if (actionType !== EXTRACT_LIST_ACTION) return undefined;
  const dispatch = webAutomationExtractListDispatch(parameters);
  if (dispatch.ok) return undefined;
  const error = dispatch.result.outputs?.error;
  const code = isJsonRecord(error) && typeof error.code === "string" ? [error.code] : [];
  const issues = isJsonRecord(error) && Array.isArray(error.issues) ? error.issues.flatMap(issueCode) : [];
  return [...new Set([...code, ...issues])];
}

function issueCode(issue: JsonValue): string[] {
  if (typeof issue === "string") return [issue];
  return isJsonRecord(issue) && typeof issue.code === "string" ? [issue.code] : [];
}
