// The extraction step's record output, read at submit exactly as the step's
// dispatch reads it when the Flow runs (t489).
//
// Lane D round 13 (`run-mv66sc3c-c47e74b8`) submitted a read of a detected
// list whose record output named its own columns, `name` and `mutualFriends`.
// Submit accepted it; the dispatch stored the detector's keys instead and Core
// refused the record output's `process` on the last step of every trial. The
// cause was two readers of one value. So there is one: the extraction node's
// `webAutomationStoredColumns` (`output-nodes/extract-list/stored-columns.ts`),
// which this module calls on the read the slot resolved, before the Flow keeps
// it, and the dispatch calls again when the Flow runs.
//
// - `webPlanStoredColumns`: the read with each column the record output names
//   under the author's name -- what `fields: {name: "<key>"}` would have said --
//   so the Flow saves the read its record output describes, and every guess on
//   the way is reported as an assumption at the record output's own position.
// - `webPlanUndispatchable`: the step put through its own dispatch, dry, once
//   its parameters are final. Whatever the dispatch would refuse -- a column the
//   read does not read, or a record output Core's parser refuses as the dispatch
//   builds it -- is refused here, at submit, while the model can still change
//   it. A plan accepted here is a plan the dispatch runs. Nothing is run: the
//   dispatch only builds a payload.
//
// **A refusal names what to change (t489, `../issue-position.ts`).** The
// model's own name and the read's column keys are structure, not page values;
// without them run `run-mv66sc3c` resubmitted the same script until the build
// gave up. A refusal carries them as `issues: [{code, field?, valid?}]` beside
// its codes, the shape Core reads on a refused answer
// (`runtime/llm/harness-options/plan-parameter-resolution.ts`) and tells the
// model in its own sentence, naming the field and the names it can use. A
// column refusal is `{code: "web.handle.unknown_field", field: <the name>,
// valid: <the read's column keys>}`, from the same issues the dispatch puts in
// its `outputs.error.issues` (`webAutomationStoredColumnIssues`), so submit and
// run time say the same thing. Any other dispatch refusal carries the
// dispatch's own issues and its Core codes. Each issue is held to Core's
// bounds -- at most 16, a code in its alphabet, each name an identifier of at
// most 200 characters, at most 64 names -- so Core drops nothing it was sent.
// The fix is either name: a read column's key in the record output, or the
// author's name kept in `extractList.fields` (`{"name": "<key>"}`), which the
// `web.handle.expected.extract_list.handle_fields` hint beside it names.
//
// Only a Flow's step is put through the dry dispatch. A node a caller runs now
// (`core.run_node`) meets its real dispatch a moment later, whose failure names
// the same field and columns, and a resolver refusal there reaches the model as
// a handle refusal instead.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListRequestValue, type WebAutomationExtractListRequest } from "../../../../actions/extraction";
import { webAutomationExtractListDispatch, webAutomationStoredColumnIssues, webAutomationStoredColumns, type WebAutomationRecordOutputIssue } from "../../../../output-nodes";
import type { WebLlmNameAssumptionSaid } from "../../name-assumption";
import type { WebPlanValuePath } from "../handle-tokens";

/** One issue a refusal carries beside its codes, in the shape Core reads on a refused answer (header). */
export type WebPlanRefusalIssue = { code: string; field?: string; valid?: string[] };

/** One reason the step cannot be dispatched as written: the code, where, the codes to say after it, and its issues. */
export type WebPlanUndispatchable = {
  code: "web.handle.unknown_field" | "web.handle.malformed";
  path: WebPlanValuePath;
  details: readonly string[];
  issues: readonly WebPlanRefusalIssue[];
};

/** Core's bounds on a refusal's codes and issues (`plan-parameter-resolution.ts`). */
const ISSUE_CODE = /^[a-z0-9_.:-]{1,100}$/iu;
const ISSUE_NAME = /^[A-Za-z0-9_.:-]{1,200}$/u;
const MAX_ISSUES = 16;
const MAX_ISSUE_NAMES = 64;
/** The issue a record output naming a column its read does not read carries (`output-nodes/extract-list/stored-columns.ts`). */
const COLUMN_NOT_READ = "record_output.column_not_read";
/** Core's issues of a `process` naming a field the stored schema does not hold as a column. */
const COLUMN_ISSUES: ReadonlySet<string> = new Set([
  "record_output.column_not_read",
  "record_output.process_unknown_field",
  "record_output.process_excluded_field",
  "record_output.process_where_column_dropped"
]);

/**
 * The read `request` (a slot's resolved `extractList`) with every column the
 * record output names under the author's name, and the guesses that took. A
 * record output naming a column the read does not read leaves the read as it
 * is: `webPlanUndispatchable` refuses that step.
 */
export function webPlanStoredColumns(request: JsonObject, recordOutput: JsonValue | undefined): { request: JsonObject; assumed: WebLlmNameAssumptionSaid[] } {
  const stored = webAutomationStoredColumns(recordOutput, request as unknown as WebAutomationExtractListRequest);
  if (!stored.ok || !stored.renamed) return { request, assumed: [] };
  const assumed = stored.assumed.map((entry): WebLlmNameAssumptionSaid => ({ path: ["recordOutput", ...entry.path], written: entry.written, field: entry.field, how: entry.how, score: entry.score }));
  return { request: stored.request as unknown as JsonObject, assumed };
}

/**
 * Why the extraction step with these final parameters would be refused by its
 * own dispatch, or `undefined` when it would run (header). Each entry is one
 * refusal of the step.
 */
export function webPlanUndispatchable(parameters: JsonObject): WebPlanUndispatchable[] | undefined {
  const read = webAutomationExtractListRequestValue(parameters.extractList);
  const stored = read === undefined ? undefined : webAutomationStoredColumns(parameters.recordOutput, read);
  if (stored?.ok === false) {
    // The dispatch's own column issues, under the reason this refusal gives, so Core says each beside it.
    const issues = bounded(webAutomationStoredColumnIssues(stored.unread, stored.columns)
      .filter((issue) => issue.code === COLUMN_NOT_READ)
      .map((issue) => ({ ...issue, code: "web.handle.unknown_field" })));
    return stored.unread.map((name, index) => ({ code: "web.handle.unknown_field", path: ["recordOutput", ...name.path], details: [], issues: index === 0 ? issues : [] }));
  }
  const dispatch = webAutomationExtractListDispatch(parameters);
  if (dispatch.ok) return undefined;
  const error = dispatch.result.outputs?.error;
  const issues = isJsonObject(error) && Array.isArray(error.issues) ? error.issues.flatMap((issue) => issueOf(issue)) : [];
  const code = dispatch.result.failure?.code ?? "";
  const details = [...new Set([code, ...issues.map((issue) => issue.code)])].filter((issue) => ISSUE_CODE.test(issue));
  const columns = issues.some((issue) => COLUMN_ISSUES.has(issue.code));
  return [{
    code: columns ? "web.handle.unknown_field" : "web.handle.malformed",
    path: code.startsWith("record_output.") ? ["recordOutput"] : ["extractList"],
    details,
    issues: bounded(issues.filter((issue) => issue.field !== undefined || issue.valid !== undefined))
  }];
}

/** The issues as Core keeps them (header): at most sixteen, each code in its alphabet, each name an identifier, at most 64 names. */
function bounded(issues: readonly WebAutomationRecordOutputIssue[]): WebPlanRefusalIssue[] {
  return issues.filter((issue) => ISSUE_CODE.test(issue.code)).slice(0, MAX_ISSUES).map((issue) => {
    const kept: WebPlanRefusalIssue = { code: issue.code };
    if (issue.field !== undefined && ISSUE_NAME.test(issue.field)) kept.field = issue.field;
    const valid = (issue.valid ?? []).filter((name) => ISSUE_NAME.test(name)).slice(0, MAX_ISSUE_NAMES);
    if (valid.length > 0) kept.valid = valid;
    return kept;
  });
}

/** One of the dispatch's issues: an object of the one shape, or a bare code as an older producer writes it. */
function issueOf(issue: JsonValue): WebAutomationRecordOutputIssue[] {
  if (typeof issue === "string") return [{ code: issue }];
  if (!isJsonObject(issue) || typeof issue.code !== "string") return [];
  const read: WebAutomationRecordOutputIssue = { code: issue.code };
  if (typeof issue.field === "string") read.field = issue.field;
  if (Array.isArray(issue.valid)) read.valid = issue.valid.filter((name): name is string => typeof name === "string");
  return [read];
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
