// A list read the recording holds no answer for, computed from a recorded read's rows: the
// row computer (Answer First, the Simulation). A filter on columns already read needs no
// page, because the condition check is one function, `automationStudioRecordConditionHolds`,
// the same one the page runs (`content/extraction/item-filter.ts`). Every row it answers was
// recorded, and every row it leaves out was shown failing that function on recorded values.
//
// Computed only when all of this holds, and otherwise `null`, so the read stays a gap:
//
// - **The same read but for its filter.** Item, fields, frame and every other parameter are
//   equal once the filter and what moved off the page are set aside. A changed column is a
//   changed read of the page.
// - **Conditions on columns.** A condition with its own `read` tests a value no row carries,
//   so it needs the page.
// - **Every row it may keep was recorded.** A recorded read with no filter holds every row.
//   One with a filter holds its kept rows, and all the rows it rejected only when it asked
//   for them (`rejectedSamples`: every row with `true`, an exploring read; the same rows,
//   those removed alone first, with `alone`, a Flow's) and the counts say none is missing.
//   Otherwise the new filter must hold every recorded condition, so it can only narrow.
// - **One whole page.** A recorded read that was cut short, paged, or folded duplicates does
//   not hold every row of its page.
//
// Dates are judged at the recorded read's end, since a simulated run stands on the recording's
// clock (`./run-handles.ts`). A read still naming a `now` asks about another time than the
// recording, so it is not computed: the recording did not see those dates then.
// The new answer says what the rows say: counts, per-condition rejections and, when asked,
// the rejected rows. What only the page knows (seen values, marks, observations) is left out.
//
// `dedupe`, `sort` and the bounds are Core's to apply over the collection when a Flow's read
// sends them off the page (`output-nodes/extract-list/one-page-read.ts`). A read that still
// asks the page for them was not written by a Flow's dispatch, and is not computed.
//
// **One limit is real.** A condition on the page judges the text shown, and a recorded cell
// holds the text disclosed, so a value behind a "read more" can differ. Measured in the
// harness against the Flow's own live rows, not assumed away.

import { automationStudioRecordConditionHolds, type AutomationStudioRecordConditionTest } from "fluxiq/components/automation";
import type { ClientGatewayTraceOperation, ClientGatewayTraceRecordedPayload, ClientGatewayTraceStateComputedRead, ClientGatewayTraceStateRecordedRead } from "fluxiq/client-gateway";
import { webAutomationExtractListRequestRead, WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY, type WebAutomationExtractItemCondition, type WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webTraceStateReadAnswer } from "./answer-reading";

const LIST_READ = "web.dom.extract_list";
const NEXT_PAGE = "web.dom.next_page";
const NAVIGATE = "web.browser.navigate";
const SNAPSHOT = "web.dom.capture_snapshot";
/** Where an unanswered look says the page is: no page, at a name reserved never to be one (RFC 6761). */
const NO_PAGE = "https://no-recorded-page.invalid/";
/** What a list request says beside what it reads off one page. */
const SET_ASIDE: readonly string[] = ["where", "answer", "now", "dedupe", "sort", "maxItems", "minItems", "paginate"];
const OFF_THE_WIRE: readonly string[] = ["timeoutMs", "checkWaitMs", "rejectedSamples", "recordOutput", "extractList"];

type Row = { readonly [key: string]: unknown };

/** Whether a recorded answer stands for this read as it is: a read that asks for only what it kept is not answered the rows its conditions rejected. */
export function webTraceStateRecordedAnswerFits(operation: ClientGatewayTraceOperation, answer: ClientGatewayTraceRecordedPayload | null): boolean {
  if (operation.actionType !== LIST_READ || answer === null) return true;
  const asks = recordOf(recordOf(operation.compared.parameters)?.extractList)?.answer;
  return !(asks === WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT && conditionsOf(answer)?.unfiltered === true);
}

/**
 * What a read or a page move the recording cannot answer is told, so the run can go on: that
 * nothing was read and nothing moved. It carries no rows, no page and no recorded value, and
 * the gap it stands for leaves the verdict `inconclusive`. A list read keeps nothing, and a
 * next page reports the list ended, so a loop over it goes on past it. A look shows a page
 * with nothing on it, at an address that can name no real page.
 */
export function webTraceStateUnansweredCall(operation: ClientGatewayTraceOperation): ClientGatewayTraceRecordedPayload | null {
  const parameters = recordOf(operation.compared.parameters);
  const answer = { actionType: operation.actionType, status: "succeeded", message: "The recording holds no answer for this call." };
  if (operation.actionType === LIST_READ) {
    const fieldNames = Object.keys(recordOf(recordOf(parameters?.extractList)?.fields) ?? {});
    return { status: "succeeded", payload: { ...answer, extracted: [], extraction: { recordCount: 0, pagesRead: 1, itemsSeen: 0, truncated: false, missingFields: [], fieldNames } } };
  }
  if (operation.actionType === NEXT_PAGE) return { status: "succeeded", payload: { ...answer, nextPage: { outcome: "ended", reason: "no_following_page" }, route: "ended" } };
  if (operation.actionType === SNAPSHOT) return { status: "succeeded", payload: { ...answer, url: NO_PAGE, snapshot: { url: NO_PAGE, title: "", interactiveElements: [] } } };
  if (operation.actionType === NAVIGATE) return { status: "succeeded", payload: { ...answer, ...(typeof parameters?.url === "string" ? { url: parameters.url } : {}) } };
  return { status: "succeeded", payload: answer };
}

export function webTraceStateComputeRead(operation: ClientGatewayTraceOperation, recorded: readonly ClientGatewayTraceStateRecordedRead[]): ClientGatewayTraceStateComputedRead | null {
  if (operation.actionType !== LIST_READ) return null;
  const parameters = recordOf(operation.compared.parameters);
  const read = requestOf(parameters);
  if (parameters === undefined || read === null) return null;
  if (read.dedupe !== undefined || read.sort !== undefined || read.maxItems !== undefined || read.paginate !== undefined || read.now !== undefined) return null;
  const conditions = read.where ?? [];
  if (conditions.some((condition) => condition.field === undefined)) return null;
  // The latest read of this state that can answer: a page settles, and the last look is the one the run stands on.
  for (const source of [...recorded].reverse()) {
    const universe = rowsOfRecordedRead(source, conditions, parameters);
    if (universe === null) continue;
    return computedAnswer(source, universe, read, conditions, parameters);
  }
  return null;
}

/** Every row of the page this recorded read can vouch for, or `null` when it cannot answer this read. */
function rowsOfRecordedRead(source: ClientGatewayTraceStateRecordedRead, conditions: readonly WebAutomationExtractItemCondition[], parameters: Record<string, unknown>): readonly Row[] | null {
  const sourceParameters = recordOf(source.operation.compared.parameters);
  const recordedRead = requestOf(sourceParameters);
  if (sourceParameters === undefined || recordedRead === null) return null;
  if (!sameReadApartFromFilter(parameters, sourceParameters)) return null;
  const reading = webTraceStateReadAnswer(source.answer);
  if (reading.outcome !== "succeeded") return null;
  const payload = recordOf(source.answer.payload);
  const summary = recordOf(payload?.extraction);
  if (summary === undefined || summary.truncated === true || (typeof summary.pagesRead === "number" && summary.pagesRead > 1)) return null;
  if (typeof recordOf(summary.order)?.duplicates === "number" && (recordOf(summary.order)!.duplicates as number) > 0) return null;
  if (typeof summary.pageRepeats === "number" && summary.pageRepeats > 0) return null;
  const answered = Array.isArray(payload?.extracted) ? payload.extracted.filter((row): row is Row => recordOf(row) !== undefined) : null;
  if (answered === null) return null;
  const recordedConditions = recordedRead.where ?? [];
  if (recordedConditions.length === 0) return answered;
  const report = recordOf(summary.conditions);
  const kept = report?.unfiltered === true ? [] : answered;
  const rejected = wholeRejectedRows(summary, report, sourceParameters, answered);
  if (rejected !== null) return [...kept, ...rejected];
  // Only the kept rows are known: every recorded condition must still hold, so the new filter can only narrow them.
  const carried = recordedConditions.every((condition) => conditions.some((asked) => canonicalJson(asked) === canonicalJson(condition)));
  return carried ? kept : null;
}

/** Every row the recorded conditions rejected, once each, when the read asked for them and the counts say no row is missing. */
function wholeRejectedRows(summary: Record<string, unknown>, report: Record<string, unknown> | undefined, parameters: Record<string, unknown>, answered: readonly Row[]): readonly Row[] | null {
  if ((parameters.rejectedSamples !== true && parameters.rejectedSamples !== WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY) || !Array.isArray(summary.rejectedSamples) || report === undefined) return null;
  const seen = new Map<string, Row>();
  for (const list of summary.rejectedSamples) {
    if (!Array.isArray(list)) return null;
    for (const row of list) {
      if (recordOf(row) !== undefined) seen.set(canonicalJson(row), row as Row);
    }
  }
  const rejectedRows = report.unfiltered === true ? answered.length : (typeof report.applied === "number" && typeof report.kept === "number" ? report.applied - report.kept : Number.NaN);
  // Two rows with every column alike are one here, so a shortfall may be repeats and not loss: it is refused all the same.
  return seen.size === rejectedRows ? [...seen.values()] : null;
}

function computedAnswer(source: ClientGatewayTraceStateRecordedRead, universe: readonly Row[], read: WebAutomationExtractListRequest, conditions: readonly WebAutomationExtractItemCondition[], parameters: Record<string, unknown>): ClientGatewayTraceStateComputedRead {
  const payload = recordOf(source.answer.payload) ?? {};
  const now = recordedInstant(payload);
  const rejectedBy = universe.map((row) => conditions.flatMap((condition, index) => (automationStudioRecordConditionHolds(condition as AutomationStudioRecordConditionTest, valueIn(row, condition.field!), now) ? [] : [index])));
  const kept = universe.filter((_, index) => rejectedBy[index]!.length === 0);
  const summary = { ...recordOf(payload.extraction) };
  for (const field of ["rejectedSamples", "rejectedSamplesAlone", "rejectedObservations", "rejectedMarks", "conditions", "listContinues"]) delete summary[field];
  summary.recordCount = kept.length;
  if (conditions.length > 0) {
    summary.conditions = {
      applied: universe.length,
      kept: kept.length,
      rejected: conditions.map((_, index) => rejectedBy.filter((list) => list.includes(index)).length),
      unfiltered: false,
      alone: conditions.map((_, index) => rejectedBy.filter((list) => list.length === 1 && list[0] === index).length)
    };
    if (parameters.rejectedSamples === WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_ONLY || parameters.rejectedSamples === true) {
      const alone = conditions.map((_, index) => universe.filter((_row, row) => rejectedBy[row]!.length === 1 && rejectedBy[row]![0] === index));
      const withOthers = conditions.map((_, index) => universe.filter((_row, row) => rejectedBy[row]!.length > 1 && rejectedBy[row]!.includes(index)));
      summary.rejectedSamples = conditions.map((_, index) => [...alone[index]!, ...withOthers[index]!]);
      summary.rejectedSamplesAlone = alone.map((rows) => rows.length);
    }
  }
  const answer: ClientGatewayTraceRecordedPayload = { ...source.answer, payload: { ...payload, extracted: kept, extraction: summary } };
  return { from: source.entry, answer, rows: webTraceStateReadAnswer(answer).rows ?? [] };
}

function valueIn(row: Row, key: string): string | undefined {
  const value = Object.hasOwn(row, key) ? row[key] : undefined;
  return typeof value === "string" ? value : undefined;
}

/** The recorded read's own end, the instant its page judged by when it was told none. */
function recordedInstant(payload: Record<string, unknown>): number {
  return typeof payload.finishedAt === "number" ? payload.finishedAt : typeof payload.startedAt === "number" ? payload.startedAt : Date.now();
}

/** Whether two list reads are one read of the page, their filters and what they ask beside it set aside. */
function sameReadApartFromFilter(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return canonicalJson(pageRead(left)) === canonicalJson(pageRead(right));
}

function pageRead(parameters: Record<string, unknown>): unknown {
  const rest: Record<string, unknown> = { ...parameters };
  for (const field of OFF_THE_WIRE) delete rest[field];
  delete rest.newTab;
  const list: Record<string, unknown> = { ...recordOf(parameters.extractList) };
  for (const field of SET_ASIDE) delete list[field];
  return { rest, list };
}

function requestOf(parameters: Record<string, unknown> | undefined): WebAutomationExtractListRequest | null {
  const read = webAutomationExtractListRequestRead(parameters?.extractList);
  return read.request === undefined || read.dropped.length > 0 ? null : read.request;
}

function conditionsOf(answer: ClientGatewayTraceRecordedPayload): Record<string, unknown> | undefined {
  return recordOf(recordOf(recordOf(answer.payload)?.extraction)?.conditions);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const record = recordOf(value);
  if (record === undefined) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) sorted[key] = canonical(record[key]);
  return sorted;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
