// One canonical form for a web call, so an exploration's call and a Flow step's call
// compare as what they are. The live wire stays as it is: each path keeps sending what it
// sends, and this is how the rule reads both. Six normalisations, each declared, and
// nothing else:
//
// - `target_form`: a Flow step's call writes the recorded element twice more than an
//   exploration's: `target` on the wire and `parameters.target`, both Core's lossy
//   re-derivation of it (`client/gateway-mapping.ts`, `elementFingerprintSources`).
//   They are dropped only when they name the same element, by the domain's own test:
//   `adaptedTargetSupersedesRecording` says no, the wire target's selector is the
//   call's, and the wire element holds nothing the recorded element contradicts. A
//   repair that renamed the control keeps them, so it stays a different call.
// - `wait_fields`: `parameters.timeoutMs` and `parameters.checkWaitMs`. What a
//   different wait may be answered with is rule 7, not a match.
// - `new_tab`: `parameters.newTab`. Which tab a page opens in does not say which page.
// - `run_handles`: `parameters.browserTabId` and `browserFrameId`, handles a run mints for
//   itself. `./run-handles.ts` writes them as where they stand in the run, before a key
//   is made, so a tab the run opened still differs from the one it started on.
// - `read_asks`: what a Flow's list read asks of the page beside what it reads, added by
//   its dispatch and never by an exploration's read (`output-nodes/extract-list/dispatch.ts`):
//   `rejectedSamples`, information for a judge; `recordOutput`, Core's instruction, which
//   never reaches the page; `extractList.answer`, whether a read that kept nothing answers
//   the rows it rejected, which is `recordedAnswerFits`'s to check; and `extractList.now`,
//   the instant relative dates are judged at, only on a read with no date to judge.
//   An instant on a read that does judge a date is `run_clock`'s (`./run-handles.ts`).
//
// Never normalised, because each is a real difference: row identity
// (`element.context.record`, `listPosition`), `where`, `text`, `url`, `value`,
// `checked`, `ensureState`, and every other parameter. `siblingKey` alone leaves row
// identity out, to say two acts are one act on two rows of a list.

import type { ClientGatewayTraceOperation, ClientGatewayTraceStateNormalisation } from "fluxiq/client-gateway";
import { automationStudioRecordConditionComparesDates, type AutomationStudioRecordConditionTest } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListRequestValue } from "../../../actions/extraction";
import { adaptedTargetSupersedesRecording } from "../../../output-nodes";

const WAIT_FIELDS: readonly string[] = ["timeoutMs", "checkWaitMs"];
const NEW_TAB = "newTab";
const READ_ASKS: readonly string[] = ["rejectedSamples", "recordOutput"];
const ROW_IDENTITY: readonly string[] = ["record", "listPosition"];

export const WEB_TRACE_STATE_NORMALISATIONS: readonly ClientGatewayTraceStateNormalisation[] = Object.freeze([
  Object.freeze({ id: "target_form", why: "a Flow step's wire target and adapted target are lossy copies of the recorded element, dropped only when they name that same element" }),
  Object.freeze({ id: "wait_fields", why: "parameters.timeoutMs and checkWaitMs: a different wait is rule 7, not a different call" }),
  Object.freeze({ id: "new_tab", why: "parameters.newTab says which tab, not which page" }),
  Object.freeze({ id: "run_handles", why: "parameters.browserTabId and browserFrameId are minted per run, so each is read as where it stands in the run; a tab the run opened still differs" }),
  Object.freeze({ id: "run_clock", why: "extractList.now inside the time the recording spans is the recording's own clock, which a simulated run stands on; an instant outside it stays a different read" }),
  Object.freeze({ id: "read_asks", why: "rejectedSamples, recordOutput, extractList.answer, and extractList.now on a read with no date to judge: asked beside the read, and they change no row it keeps" })
]);

export function webTraceStateCanonicalKey(operation: ClientGatewayTraceOperation): string {
  return JSON.stringify(canonicalForm(operation));
}

export function webTraceStateSiblingKey(operation: ClientGatewayTraceOperation): string {
  const form = canonicalForm(operation);
  return JSON.stringify({ ...form, parameters: withoutRowIdentity(form.parameters) });
}

type CanonicalForm = { readonly actionType: string; readonly target: unknown; readonly parameters: JsonObject };

function canonicalForm(operation: ClientGatewayTraceOperation): CanonicalForm {
  const { actionType, target, parameters: raw } = operation.compared;
  const parameters: Record<string, unknown> = isRecord(raw) ? { ...raw } : {};
  for (const field of WAIT_FIELDS) delete parameters[field];
  delete parameters[NEW_TAB];
  for (const field of READ_ASKS) delete parameters[field];
  if (isRecord(parameters.extractList)) parameters.extractList = withoutReadAsks(parameters.extractList);
  if (!namesSameElement(target, parameters)) return { actionType, target, parameters: parameters as JsonObject };
  if (isRecord(target)) {
    if (parameters.selector === undefined && target.selector !== undefined) parameters.selector = target.selector;
    if (parameters.element === undefined && target.element !== undefined) parameters.element = target.element;
  }
  delete parameters.target;
  return { actionType, target: null, parameters: parameters as JsonObject };
}

/** A list request without what it asks beside the read: `now` stays when a date is judged, because it can change the rows. */
function withoutReadAsks(written: { readonly [key: string]: unknown }): { readonly [key: string]: unknown } {
  const { answer: _answer, ...read } = written;
  if (judgesDates(written)) return read;
  const { now: _now, ...undated } = read;
  return undated;
}

function judgesDates(written: { readonly [key: string]: unknown }): boolean {
  const request = webAutomationExtractListRequestValue(written);
  if (request === undefined) return true;
  return (request.sort?.length ?? 0) > 0 || (request.where ?? []).some((condition) => automationStudioRecordConditionComparesDates(condition as AutomationStudioRecordConditionTest));
}

/** Whether the call's wire and adapted targets only restate its recorded element. */
function namesSameElement(target: unknown, parameters: Record<string, unknown>): boolean {
  if (adaptedTargetSupersedesRecording(parameters as JsonObject)) return false;
  if (target === null || target === undefined) return true;
  if (!isRecord(target)) return false;
  if (parameters.selector !== undefined && target.selector !== undefined && target.selector !== parameters.selector) return false;
  return parameters.element === undefined || target.element === undefined || restates(target.element, parameters.element);
}

/** Whether every field `copy` holds is the same in `original`: a lossy copy holds less, and nothing else. */
function restates(copy: unknown, original: unknown): boolean {
  if (!isRecord(copy) || !isRecord(original)) return JSON.stringify(copy) === JSON.stringify(original);
  return Object.keys(copy).every((key) => original[key] === undefined ? false : restates(copy[key], original[key]));
}

function withoutRowIdentity(parameters: JsonObject): JsonObject {
  const element = parameters.element;
  if (!isRecord(element) || !isRecord(element.context)) return parameters;
  const context: Record<string, unknown> = { ...element.context };
  for (const field of ROW_IDENTITY) delete context[field];
  return { ...parameters, element: { ...element, context } } as JsonObject;
}

function isRecord(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
