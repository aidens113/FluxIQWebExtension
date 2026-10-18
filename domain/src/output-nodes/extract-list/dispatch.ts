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
// **One page (read-list redesign S4, contract C3).** A Flow reads a list one
// page a pass: a Next page step and a repeat go through the rest, and the run's
// dataset collects each pass. So a read whose `paginate` goes past one page --
// any `maxPages` above 1, or any scroll -- is refused before anything runs,
// with `web.extract_list.paginate_retired` and a sentence that names the loop,
// rather than read one page and reported a success
// (`../../actions/extraction/retired-paging.ts`). What is left reads one page,
// and `dedupe`, `sort`, `maxItems` and `minItems` leave it for the record
// output's `process` (`./one-page-read.ts`), in the derived output and the
// reconciled one alike (`./record-output-process.ts`). An author's own
// `process` is kept where the read says nothing of a member; a read that says
// "list each once" -- a dedupe over every column it reads -- writes no dedupe,
// and clears the author's, so Core's default whole-row identity applies. The
// whole output, `process` included, then goes through Core's record-output
// parser, so a `process` Core refuses fails the node before the page is read,
// with Core's own `record_output.process_*` issues, like any other refusal --
// each naming the field or sort key it refused and what it can use instead
// (`./process-issues.ts`, t510).
//
// **The timeout (D14).** The page reads a list within
// `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS`, and the command's `timeoutMs`
// bounds the read. A node whose author left the default -- sent none, which is
// what Core passes for an unset parameter, or sent the default itself, which
// is what an editor prefills -- is given the page's wait. Any other value is the
// author's decision and is sent as it is. Until S4 the wait was scaled by the
// pages a read could follow; a read now follows none.
//
// **And the timeout is the dispatch's own, not only the page's.** Core gives a
// command the time its dispatch payload's `timeoutMs` names, plus its answer
// margin, and a command that names none gets the gateway's default of 30 s
// (Core `runtime/io-policy.ts`, `client-gateway/service/commands.ts`). Until
// 2026-09-30 the timeout travelled in `parameters` alone, and a long read was
// abandoned by Core while the page was still reading it. So the node's final
// `timeoutMs` is sent beside the parameters too.
//
// **The rows each condition removed by itself (t194 w49).** A read with `where`
// conditions is sent asking the page for the rows each condition removed by
// itself -- rows every other condition kept -- leading each list, then the rows
// it removed together with another condition, without their observations, so a
// read's labels can cover every row it saw (t655)
// (`WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY`). On live run 15
// (`run-muqj2bgb-d048ec37`) the Flow held 10 of 13 earbuds: the accessory rule
// `name not contains ["charging case", ...]` removed by itself three earbuds sold
// "with Wireless Charging Case", and the judge was told only "5 of them by
// itself" and passed it. The rows reach the judge's read account as labels
// (Core `runtime/result-verification/read-account/`). Information only: the
// read keeps and stores exactly what it did. A Flow whose parameters already
// say `rejectedSamples` is sent as it says. The draft's replay asks the same
// way (`webAutomationExtractListAloneRowsAsked`, t194 w55), for the judge of
// the build's test.
//
// **Only the rows it kept (C5).** A Flow's read, and the replay's, also asks the
// page to answer only the rows it kept, possibly none (`answer: "kept"`): a
// page with no qualifying item is an ordinary pass of a loop, not a failed
// read, and its rejected rows are not the instruction's.
//
// **The stored columns (t489).** Before anything else, the names the record
// output writes for its columns are read against the read's own columns by the
// one function the plan resolver reads them with at submit
// (`./stored-columns.ts`): a name matching a column renames that column in the
// read, and a name matching none refuses the node, naming it and the read's
// columns. So a record output accepted at submit is one this dispatch stores,
// and run `run-mv66sc3c-c47e74b8`'s schema of `name` and `mutualFriends` over a
// detected read can no longer pass one and fail the other.
//
// A request that does not parse derives nothing and moves nothing: it is sent
// as authored, and the dispatch refuses it with its own reason.

// The value comes from the narrow `nodes` entry point: this module is bundled
// into the browser extension, and Core's whole `automation-studio` entry point
// reaches Node-only modules (`node:crypto`) that a browser bundle cannot load.
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio/nodes";
import type { AutomationNodeExecutionResult } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT,
  WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS,
  WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY,
  WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY,
  webAutomationExtractListPagesBeyondOne,
  webAutomationExtractListRequestValue,
  type WebAutomationExtractListRequest
} from "../../actions/extraction";
import { webAutomationDeclaredColumnsRead } from "./declared-columns";
import { webAutomationDedupeLinkIdentity } from "./dedupe-link-identity";
import { webAutomationDerivedRecordOutput } from "./derived-record-output";
import { webAutomationExtractListOnePageRead } from "./one-page-read";
import { webAutomationReconciledRecordOutput } from "./reconciled-record-output";
import { webAutomationRecordOutputIssues } from "./process-issues";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "./records-path";
import { webAutomationStoredColumnIssues, webAutomationStoredColumns, type WebAutomationStoredColumnName } from "./stored-columns";

/** The dispatch payload's fields beside `outputId`, or the node's refusal when its record output cannot be saved. */
export type WebAutomationExtractListDispatch =
  | { ok: true; payload: JsonObject }
  | { ok: false; result: AutomationNodeExecutionResult };

/** Core's issue for a field asking to be encrypted, which nothing can do yet (`record_schema.encrypt_unavailable`). */
const ENCRYPT_UNAVAILABLE_ISSUE = "record_schema.encrypt_unavailable";

export function webAutomationExtractListDispatch(nodeParameters: JsonObject): WebAutomationExtractListDispatch {
  const { recordOutput: authored, ...rest } = nodeParameters;
  if (isJsonObject(rest.extractList) && webAutomationExtractListPagesBeyondOne(rest.extractList.paginate)) return { ok: false, result: pagingRetiredRefusal() };
  const read = webAutomationExtractListRequestValue(rest.extractList);
  const stored = read === undefined ? undefined : webAutomationStoredColumns(authored, read);
  if (stored?.ok === false) return { ok: false, result: unreadColumnsRefusal(stored.unread, stored.columns) };
  const written = stored?.request ?? read;
  const identity = written === undefined ? undefined : webAutomationDedupeLinkIdentity(authored, written);
  const narrowed = identity === undefined ? undefined : webAutomationDeclaredColumnsRead(authored, identity);
  const request = narrowed?.request ?? identity;
  // A request that parsed was an object, as written, renamed or narrowed.
  const sent = narrowed !== undefined ? narrowed.request as unknown as JsonObject
    : identity !== undefined && identity !== written ? identity as unknown as JsonObject
    : stored?.renamed === true ? stored.request as unknown as JsonObject : rest.extractList as JsonObject;
  const onePage = request === undefined ? undefined : webAutomationExtractListOnePageRead(sent, request);
  const page = onePage === undefined ? rest : { ...rest, extractList: onePage.page };
  const timed = request !== undefined && leftDefault(page.timeoutMs) ? { ...page, timeoutMs: WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS } : page;
  const parameters = withFlowAsks(timed, request);
  const declared = authored === undefined || authored === null
    ? request === undefined ? undefined : webAutomationDerivedRecordOutput(request)
    : request === undefined ? withRecordsPath(authored) : webAutomationReconciledRecordOutput(authored, request, narrowed?.columns, narrowed?.shown);
  const timeout = commandTimeout(parameters.timeoutMs);
  if (declared === undefined) return { ok: true, payload: { parameters, ...timeout } };
  const processed = withReadProcess(declared, onePage);
  const parsed = parseAutomationStudioRecordOutput(processed);
  if (!parsed.ok) return { ok: false, result: recordOutputRefusal(parsed.issues, processed) };
  // The parsed output is plain JSON; its type only spells the optional keys.
  const recordOutput = parsed.output as unknown as JsonObject;
  return { ok: true, payload: { parameters, ...timeout, recordOutput } };
}

/**
 * A list read's parameters asking for only the rows it kept (`answer:
 * "kept"`), and for the rows each condition removed by itself when it has
 * conditions and does not already say; a value that is not a read, as it is.
 * The draft's replay asks with this too
 * (`runtime/llm-evidence/node-run/replay.ts`, t194 w55), so the judge of a
 * build's test is shown what a playback's judge is.
 */
export function webAutomationExtractListAloneRowsAsked(parameters: JsonObject): JsonObject {
  return withFlowAsks(parameters, webAutomationExtractListRequestValue(parameters.extractList));
}

/** The parameters a Flow's read is sent with: only the rows it kept, and the rows each condition removed by itself (see the header). */
function withFlowAsks(parameters: JsonObject, request: WebAutomationExtractListRequest | undefined): JsonObject {
  if (request === undefined || !isJsonObject(parameters.extractList)) return parameters;
  const asked = { ...parameters, extractList: { ...parameters.extractList, answer: WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT } };
  if (!request.where?.length || Object.hasOwn(parameters, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY)) return asked;
  return { ...asked, [WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY]: WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY };
}

/**
 * The record output with the read's processing over its author's: the read's
 * members win where both say, and a whole-row dedupe clears the author's (see
 * the header). An output that is not an object, or a `process` that is not
 * one, is handed on as it is, for Core's parser to refuse.
 */
function withReadProcess(declared: JsonValue, onePage: ReturnType<typeof webAutomationExtractListOnePageRead> | undefined): JsonValue {
  if (onePage === undefined || !isJsonObject(declared)) return declared;
  const authored = declared.process;
  if (authored !== undefined && !isJsonObject(authored)) return declared;
  const { dedupe, ...rest } = authored ?? {};
  const kept: JsonObject = onePage.wholeRowDedupe || dedupe === undefined ? rest : { ...rest, dedupe };
  const process: JsonObject = { ...kept, ...(onePage.process as JsonObject | undefined) };
  const { process: _process, ...output } = declared;
  return Object.keys(process).length > 0 ? { ...output, process } : output;
}

/**
 * The node's refusal of a read that goes through pages by itself. It names the
 * loop that does that now, which is also what a repair has to build.
 */
function pagingRetiredRefusal(): AutomationNodeExecutionResult {
  const code = "web.extract_list.paginate_retired";
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
    outputs: { error: { code } },
    message: "This step used to go through pages by itself; the Flow now needs a Next page step and a repeat.",
    failure
  };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

/** How much of a column list one failure sentence holds (Core bounds `expected` and `actual`). */
const FAILURE_SENTENCE_MAX = 900;

/**
 * The node's refusal of a record output naming columns its read does not read
 * (`./stored-columns.ts`): Core's `record_output.invalid`, with the names and
 * the read's columns said in `expected` and `actual`, which reach the model's
 * trial feedback. Submit refuses the same names (`plan-resolution`), so a Flow
 * built through it never arrives here; a Flow saved before t489 can.
 */
function unreadColumnsRefusal(unread: readonly WebAutomationStoredColumnName[], columns: readonly string[]): AutomationNodeExecutionResult {
  const code = "record_output.invalid";
  // `{code, field, valid}` each, the one shape Core's trial feedback reads (`./stored-columns.ts`).
  const issues = webAutomationStoredColumnIssues(unread, columns) as unknown as JsonObject[];
  const failure: AutomationStudioFailureRecord = {
    category: "graph_validation_or_unknown_node",
    code,
    retryable: false,
    stage: "dispatch",
    expected: bounded(`recordOutput names only columns the read reads: ${columns.join(", ")}`),
    actual: bounded(`recordOutput names columns the read does not read: ${unread.map((name) => name.written).join(", ")}`)
  };
  return {
    status: "failed",
    route: "failed",
    effects: [],
    outputs: { error: { code, issues } },
    message: "Save extracted records names columns the list does not read, so the list was not read.",
    failure
  };
}

function bounded(sentence: string): string {
  return sentence.length <= FAILURE_SENTENCE_MAX ? sentence : `${sentence.slice(0, FAILURE_SENTENCE_MAX - 3)}...`;
}

/**
 * The node's refusal of a record output Core's parser refuses: Core's codes,
 * each as `{code, field?, valid?}` read from the output it refused
 * (`./process-issues.ts`, t510), the one shape `./stored-columns.ts` gives.
 */
function recordOutputRefusal(issues: readonly string[], output: JsonValue): AutomationNodeExecutionResult {
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
    outputs: { error: { code, issues: webAutomationRecordOutputIssues(issues, output) as unknown as JsonObject[] } },
    message: encryptUnavailable
      ? "Save extracted records asks to encrypt a field, which is not available yet, so the list was not read."
      : "Save extracted records is not a valid record output, so the list was not read.",
    failure
  };
}
