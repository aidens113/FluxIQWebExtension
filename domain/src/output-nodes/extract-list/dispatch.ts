// What a `web.dom.extract_list` node dispatches beyond its parameters.
//
// **The record output.** Core saves an output's rows only when the dispatch
// effect carries `recordOutput` (`runtime/executor/record-capture.ts`), so a
// node that sends none reads the page and stores nothing. The node sends the
// one its author set, or else the one derived from its extraction
// (`./derived-record-output.ts`). Either is parsed first, and one that does not
// parse fails the node **before** the page is read, exactly as Core's
// `builtin.policy.action` does, with the same codes: reading rows that cannot be
// saved as declared would only collect them. The record output leaves the
// parameters, because it is Core's instruction rather than the page's.
//
// An author's record output may leave `recordsPath` out, since the output
// declares where its records are (`./records-path.ts`, CD19); one that names a
// path is sent as named, and Core reports it if nothing is there.
//
// **The timeout (D14).** The page reads each page of a list within
// `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS`, and the command's `timeoutMs`
// bounds the whole read, so a paginated read with the node's default is cut
// short at its first page wait. A node whose author left the default -- sent
// none, which is what Core passes for an unset parameter, or sent the default
// itself, which is what an editor prefills -- is given the scaled timeout. Any
// other value is the author's decision and is sent as it is.
//
// A request that does not parse derives nothing and scales nothing: it is sent
// as authored, and the dispatch refuses it with its own reason.

// The value comes from the narrow `nodes` entry point: this module is bundled
// into the browser extension, and Core's whole `automation-studio` entry point
// reaches Node-only modules (`node:crypto`) that a browser bundle cannot load.
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio/nodes";
import type { AutomationNodeExecutionResult } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS,
  webAutomationExtractListRequestValue,
  webAutomationExtractListTimeoutMs
} from "../../actions/extraction";
import { webAutomationDerivedRecordOutput } from "./derived-record-output";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "./records-path";

/** The dispatch payload's fields beside `outputId`, or the node's refusal when its record output cannot be saved. */
export type WebAutomationExtractListDispatch =
  | { ok: true; payload: JsonObject }
  | { ok: false; result: AutomationNodeExecutionResult };

/** Core's issue for a field asking to be encrypted, which nothing can do yet (`record_schema.encrypt_unavailable`). */
const ENCRYPT_UNAVAILABLE_ISSUE = "record_schema.encrypt_unavailable";

export function webAutomationExtractListDispatch(nodeParameters: JsonObject): WebAutomationExtractListDispatch {
  const { recordOutput: authored, ...rest } = nodeParameters;
  const request = webAutomationExtractListRequestValue(rest.extractList);
  const parameters = request !== undefined && leftDefault(rest.timeoutMs)
    ? { ...rest, timeoutMs: webAutomationExtractListTimeoutMs(request) }
    : rest;
  const declared = authored === undefined || authored === null
    ? request === undefined ? undefined : webAutomationDerivedRecordOutput(request)
    : withRecordsPath(authored);
  if (declared === undefined) return { ok: true, payload: { parameters } };
  const parsed = parseAutomationStudioRecordOutput(declared);
  if (!parsed.ok) return { ok: false, result: recordOutputRefusal(parsed.issues) };
  // The parsed output is plain JSON; its type only spells the optional keys.
  return { ok: true, payload: { parameters, recordOutput: parsed.output as unknown as JsonObject } };
}

function leftDefault(timeoutMs: JsonValue | undefined): boolean {
  return timeoutMs === undefined || timeoutMs === WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS;
}

function withRecordsPath(authored: JsonValue): JsonValue {
  if (typeof authored !== "object" || authored === null || Array.isArray(authored) || Object.hasOwn(authored, "recordsPath")) return authored;
  return { ...authored, recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH };
}

function recordOutputRefusal(issues: readonly string[]): AutomationNodeExecutionResult {
  const encryptUnavailable = issues.includes(ENCRYPT_UNAVAILABLE_ISSUE);
  const code = encryptUnavailable ? "record_output.encrypt_unavailable" : "record_output.invalid";
  const failure: AutomationStudioFailureRecord = {
    category: "graph_validation_or_unknown_node",
    code,
    retryable: false,
    stage: "dispatch"
  };
  return {
    status: "failed",
    route: "failed",
    effects: [],
    outputs: { error: { code, issues: [...issues] } },
    message: encryptUnavailable
      ? "Save extracted records asks to encrypt a field, which is not available yet, so the list was not read."
      : "Save extracted records is not a valid record output, so the list was not read.",
    failure
  };
}
