// What a `web.dom.extract_list` node dispatches beyond its parameters.
//
// **The record output.** Core saves an output's rows only when the dispatch
// effect carries `recordOutput` (`runtime/executor/record-capture.ts`), so a
// node that sends none reads the page and stores nothing. The node sends the
// one derived from its extraction (`./derived-record-output.ts`), or, where its
// author set one, that output holding the columns its extraction actually reads
// (`./reconciled-record-output.ts`) -- because a schema the page cannot satisfy
// loses every row without failing anything. Either is parsed first, and one
// that does not parse fails the node **before** the page is read, exactly as
// Core's `builtin.policy.action` does, with the same codes: reading rows that
// cannot be saved as declared would only collect them. The record output leaves
// the parameters, because it is Core's instruction rather than the page's.
//
// The records path is the node's own (`./records-path.ts`, CD19) whatever an
// author wrote: the node knows where its rows are, and a path naming anywhere
// else can only find nothing. Only a request that did not parse leaves an
// authored path alone, since there is then no extraction to reconcile it with.
//
// **The declared columns (live run 11).** Where the author's record output
// names a subset of the field map, the read the page is sent keeps only those
// columns; a column kept only to filter by is read by its condition instead
// (`./declared-columns.ts`). Only then is `extractList` sent as the reader read
// it rather than as written, since only then is there anything to change.
//
// **The timeout (D14).** The page reads each page of a list within
// `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS`, and the command's `timeoutMs`
// bounds the whole read, so a paginated read with the node's default is cut
// short at its first page wait. A node whose author left the default -- sent
// none, which is what Core passes for an unset parameter, or sent the default
// itself, which is what an editor prefills -- is given the scaled timeout. Any
// other value is the author's decision and is sent as it is.
//
// **And the timeout is the dispatch's own, not only the page's.** Core gives a
// command the time its dispatch payload's `timeoutMs` names, plus its answer
// margin, and a command that names none gets the gateway's default of 30 s
// (Core `runtime/io-policy.ts`, `client-gateway/service/commands.ts`). Until
// 2026-09-30 the scaled timeout travelled in `parameters` alone: the page read
// for up to ten seconds a page while Core stopped waiting at thirty, so a paced
// read of more than about six pages -- 2.5 s between loads on one site, and each
// page revealed to its end -- would be abandoned with every row it read. So the
// node's final `timeoutMs`, scaled or authored, is sent beside the parameters
// too. The scaling is bounded as `maxPages` is, at fifty pages; a tighter cap
// would cut short a read of fifty paced pages, which needs two minutes for its
// pacing alone.
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
import { webAutomationDeclaredColumnsRead } from "./declared-columns";
import { webAutomationDerivedRecordOutput } from "./derived-record-output";
import { webAutomationReconciledRecordOutput } from "./reconciled-record-output";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "./records-path";

/** The dispatch payload's fields beside `outputId`, or the node's refusal when its record output cannot be saved. */
export type WebAutomationExtractListDispatch =
  | { ok: true; payload: JsonObject }
  | { ok: false; result: AutomationNodeExecutionResult };

/** Core's issue for a field asking to be encrypted, which nothing can do yet (`record_schema.encrypt_unavailable`). */
const ENCRYPT_UNAVAILABLE_ISSUE = "record_schema.encrypt_unavailable";

export function webAutomationExtractListDispatch(nodeParameters: JsonObject): WebAutomationExtractListDispatch {
  const { recordOutput: authored, ...rest } = nodeParameters;
  const written = webAutomationExtractListRequestValue(rest.extractList);
  const narrowed = written === undefined ? undefined : webAutomationDeclaredColumnsRead(authored, written);
  const request = narrowed?.request ?? written;
  const read = narrowed === undefined ? rest : { ...rest, extractList: narrowed.request as unknown as JsonValue };
  const parameters = request !== undefined && leftDefault(read.timeoutMs)
    ? { ...read, timeoutMs: webAutomationExtractListTimeoutMs(request) }
    : read;
  const declared = authored === undefined || authored === null
    ? request === undefined ? undefined : webAutomationDerivedRecordOutput(request)
    : request === undefined ? withRecordsPath(authored) : webAutomationReconciledRecordOutput(authored, request, narrowed?.columns);
  const timeout = commandTimeout(parameters.timeoutMs);
  if (declared === undefined) return { ok: true, payload: { parameters, ...timeout } };
  const parsed = parseAutomationStudioRecordOutput(declared);
  if (!parsed.ok) return { ok: false, result: recordOutputRefusal(parsed.issues) };
  // The parsed output is plain JSON; its type only spells the optional keys.
  return { ok: true, payload: { parameters, ...timeout, recordOutput: parsed.output as unknown as JsonObject } };
}

function leftDefault(timeoutMs: JsonValue | undefined): boolean {
  return timeoutMs === undefined || timeoutMs === WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS;
}

/** The node's timeout as the dispatch's own, which is how long Core waits for the read: a positive finite number, or nothing. */
function commandTimeout(timeoutMs: JsonValue | undefined): { timeoutMs?: number } {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {};
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
