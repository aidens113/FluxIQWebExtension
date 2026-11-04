// One saved Flow's commands walked over one exploration's recording, each answer
// compared with what the site told that Flow live, then the end check and the pure
// verdict. The walker never sees a live answer; only this comparison does.
//
// **What the live commands cannot show.** These are the commands the Flow sent given
// what the site really answered. Given recorded answers it might have sent others. One
// case can be read off and is set aside as `notSent`: the same move or act sent again
// because the site failed it, where the recording answered it with a success. Everything
// after an act-status disagreement is still counted, and it is why those are reported.

import {
  clientGatewayTraceStateEndCheck,
  clientGatewayTraceStateVerdict,
  ClientGatewayTraceStateWalker,
  type ClientGatewayTraceOperation,
  type ClientGatewayTraceStateAnswerReading,
  type ClientGatewayTraceStateDomain,
  type ClientGatewayTraceStateGapCode,
  type ClientGatewayTraceStateRecordedCall,
  type ClientGatewayTraceStateRecording,
  type ClientGatewayTraceStateWalkOptions,
} from "fluxiq/client-gateway";
import { failureCode, sameRows, selectorOverlap, SELECTORS_CLOSE_AT, SELECTORS_VERY_CLOSE_AT, snapshotSelectors } from "./answer-comparison.js";
import type { WalkTally, WalkVerdict } from "./types.js";

const SNAPSHOT = "web.dom.capture_snapshot";
const LIST_READ = "web.dom.extract_list";
const MAX_GAP_FIELD_DEPTH = 3;

export function emptyWalkTally(): WalkTally {
  return {
    commands: 0, answered: 0, commandsOnRecording: 0, answeredOnRecording: 0,
    readsSameInput: 0, readsOtherInput: 0, movesSameInput: 0, movesOtherInput: 0, actsSameInput: 0, actsOtherInput: 0,
    statusSameAll: 0, statusDifferAll: 0,
    notSent: 0, gaps: {}, readsAnswered: 0,
    urlSame: 0, urlDiffer: 0, openingUrlSame: 0, openingUrlDiffer: 0, snapshotUrlSame: 0, snapshotUrlDiffer: 0,
    selectorsClose: 0, selectorsFar: 0, selectorsVeryClose: 0, rowsSame: 0, rowsDiffer: 0, readsComputed: 0, rowsComputedSame: 0, rowsComputedDiffer: 0,
    listReadsChanged: 0, listReadsNoSamePage: 0, listReadsComputable: 0, listRowsSameAsLive: 0, listRowsDifferFromLive: 0,
    statusSameMoves: 0, statusDifferMoves: 0, statusSameActs: 0, statusDifferActs: 0,
    disagreements: {}, markedActDisagreements: 0, blindPositionUrlSame: 0, blindPositionUrlDiffer: 0, refusedUrlSame: {}, refusedUrlDiffer: {}, gapFields: {}, firstLeave: {}, actGapElements: {},
  };
}

/** How an unmatched act's element stands to the nearest recorded act's: another selector, or the same one whose descriptors agree or conflict where both hold them. Booleans only: nothing compared comes out. */
function elementRelation(left: ClientGatewayTraceOperation, right: ClientGatewayTraceOperation): string {
  const leftParameters = (left.compared.parameters ?? {}) as Readonly<Record<string, unknown>>;
  const rightParameters = (right.compared.parameters ?? {}) as Readonly<Record<string, unknown>>;
  if (leftParameters.selector !== rightParameters.selector) return "other_selector";
  const leftElement = (leftParameters.element ?? {}) as Readonly<Record<string, unknown>>;
  const rightElement = (rightParameters.element ?? {}) as Readonly<Record<string, unknown>>;
  const shared = Object.keys(leftElement).filter((key) => rightElement[key] !== undefined && rightElement[key] !== null && leftElement[key] !== null);
  const conflicts = shared.filter((key) => JSON.stringify(leftElement[key]) !== JSON.stringify(rightElement[key]));
  if (conflicts.length === 0) return "same_selector_agree";
  return `same_selector_conflict:${conflicts.sort().join("+")}`;
}

/** The row computer on a changed list read, over the recorded reads of the page the live run read: how often it can answer, and whether its rows are the live ones. */
function measureRowComputer(tally: WalkTally, operation: ClientGatewayTraceOperation, live: ClientGatewayTraceStateAnswerReading, recording: ClientGatewayTraceStateRecording, domain: ClientGatewayTraceStateDomain): void {
  tally.listReadsChanged += 1;
  const samePage = recording.entries.flatMap((entry) => (entry.call.operation.actionType === LIST_READ && entry.reading.position === live.position && entry.call.answer !== null && !entry.call.redacted ? [{ entry: entry.index, operation: entry.call.operation, answer: entry.call.answer }] : []));
  if (samePage.length === 0) {
    tally.listReadsNoSamePage += 1;
    return;
  }
  const computed = domain.computeRead(operation, samePage);
  if (computed === null) return;
  tally.listReadsComputable += 1;
  const same = sameRows({ ...live, rows: computed.rows }, live);
  if (same === true) tally.listRowsSameAsLive += 1;
  if (same === false) tally.listRowsDifferFromLive += 1;
}

function sameSet(left: ReadonlySet<number>, right: ReadonlySet<number>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

export function walkFlow(input: {
  flow: readonly ClientGatewayTraceStateRecordedCall[];
  recording: ClientGatewayTraceStateRecording;
  domain: ClientGatewayTraceStateDomain;
  options: ClientGatewayTraceStateWalkOptions;
}): { tally: WalkTally; verdict: WalkVerdict } {
  const { flow, recording, domain, options } = input;
  const tally = emptyWalkTally();
  const walker = new ClientGatewayTraceStateWalker(recording, domain, options);
  const gaps: ClientGatewayTraceStateGapCode[] = [];
  let firstGap: WalkVerdict["firstGap"] = null;
  let opening = true;
  /** The move or act the recording answered with a success and the site failed: its next attempt is one only the failure caused. */
  let retried: string | null = null;
  let left = false;
  const recordedKeys = new Set(recording.entries.map((entry) => entry.key));
  const handles = domain.handleScope();
  for (const call of flow) {
    const kind = domain.labelCall(call.operation);
    const key = domain.canonicalKey(handles(call.operation));
    const live = domain.readAnswer(call.answer);
    if (kind !== "read" && retried === key) {
      tally.notSent += 1;
      continue;
    }
    if (kind !== "read") retried = null;
    tally.commands += 1;
    const known = recordedKeys.has(key);
    if (kind === "read") {
      if (known) tally.readsSameInput += 1;
      else tally.readsOtherInput += 1;
      if (!known && call.operation.actionType === LIST_READ) measureRowComputer(tally, handles(call.operation), live, recording, domain);
    } else if (kind === "page_move") {
      if (known) tally.movesSameInput += 1;
      else tally.movesOtherInput += 1;
    } else if (known) tally.actsSameInput += 1;
    else tally.actsOtherInput += 1;
    if (!left) tally.commandsOnRecording += 1;
    if (!left && kind === "read" && live.position !== null) {
      const done = new Set(walker.used.filter((act) => !recording.receipts.has(act)));
      const blind = recording.entries.find((entry) => entry.kind === "read" && entry.key === key && entry.node !== walker.currentNode && entry.reading.position !== null && sameSet(entry.actsBefore, done));
      if (blind !== undefined) {
        if (blind.reading.position === live.position) tally.blindPositionUrlSame += 1;
        else tally.blindPositionUrlDiffer += 1;
      }
    }
    const answer = walker.answer(call.operation);
    if (!left && answer.status === "answered") tally.answeredOnRecording += 1;
    if (!left && walker.hasLeftRecording) {
      left = true;
      if (answer.status === "gap") {
        const leave = `${answer.code}|${call.operation.actionType}`;
        tally.firstLeave[leave] = (tally.firstLeave[leave] ?? 0) + 1;
      }
    }
    if (answer.status === "gap") {
      tally.gaps[answer.code] = (tally.gaps[answer.code] ?? 0) + 1;
      gaps.push(answer.code);
      firstGap ??= Object.freeze({ ordinal: call.ordinal, code: answer.code, actionType: call.operation.actionType });
      for (const field of answer.nearest?.fields ?? []) {
        const path = field.split(".").slice(0, MAX_GAP_FIELD_DEPTH).join(".").replace(/\.\d+/gu, "[]");
        tally.gapFields[path] = (tally.gapFields[path] ?? 0) + 1;
      }
      if (kind === "act" && answer.nearest !== null) {
        const relation = elementRelation(call.operation, recording.entries[answer.nearest.entry]!.call.operation);
        tally.actGapElements[relation] = (tally.actGapElements[relation] ?? 0) + 1;
      }
      if (kind === "read" && answer.refusedEntry !== null) {
        const refused = recording.entries[answer.refusedEntry]!;
        if (refused.reading.position !== null && live.position !== null) {
          const counter = refused.reading.position === live.position ? tally.refusedUrlSame : tally.refusedUrlDiffer;
          counter[answer.code] = (counter[answer.code] ?? 0) + 1;
        }
      }
      if (kind !== "read") opening = false;
      continue;
    }
    tally.answered += 1;
    const entry = recording.entries[answer.entry]!;
    if (answer.computed !== null) {
      tally.readsComputed += 1;
      const computedRows = sameRows({ ...entry.reading, rows: answer.computed.rows }, live);
      if (computedRows === true) tally.rowsComputedSame += 1;
      if (computedRows === false) tally.rowsComputedDiffer += 1;
    }
    if (entry.reading.outcome === live.outcome) tally.statusSameAll += 1;
    else tally.statusDifferAll += 1;
    if (kind === "read") {
      tally.readsAnswered += 1;
      if (entry.reading.position !== null && live.position !== null) {
        const same = entry.reading.position === live.position;
        if (opening) {
          if (same) tally.openingUrlSame += 1;
          else tally.openingUrlDiffer += 1;
        } else {
          if (same) tally.urlSame += 1;
          else tally.urlDiffer += 1;
          if (call.operation.actionType === SNAPSHOT) {
            if (same) tally.snapshotUrlSame += 1;
            else tally.snapshotUrlDiffer += 1;
          }
        }
      }
      if (!opening) {
        const recordedSelectors = snapshotSelectors(entry.call.answer);
        const liveSelectors = snapshotSelectors(call.answer);
        if (recordedSelectors !== null && liveSelectors !== null) {
          const overlap = selectorOverlap(recordedSelectors, liveSelectors);
          if (overlap >= SELECTORS_CLOSE_AT) tally.selectorsClose += 1;
          else tally.selectorsFar += 1;
          if (overlap >= SELECTORS_VERY_CLOSE_AT) tally.selectorsVeryClose += 1;
        }
      }
      const rows = answer.computed === null ? sameRows(entry.reading, live) : null;
      if (rows === true) tally.rowsSame += 1;
      if (rows === false) tally.rowsDiffer += 1;
      continue;
    }
    const same = entry.reading.outcome === live.outcome;
    if (kind === "act") {
      if (same) tally.statusSameActs += 1;
      else tally.statusDifferActs += 1;
    } else if (same) tally.statusSameMoves += 1;
    else tally.statusDifferMoves += 1;
    if (!same) {
      const reason = `${kind}|recorded_${entry.reading.outcome}|live_${live.outcome}|${failureCode(call.answer)}|${answer.mayBeGoneNextTime ? "layer" : "not_layer"}`;
      tally.disagreements[reason] = (tally.disagreements[reason] ?? 0) + 1;
      if (answer.mayBeGoneNextTime) tally.markedActDisagreements += 1;
    }
    if (entry.reading.outcome === "succeeded" && live.outcome !== "succeeded") retried = key;
    if (entry.reading.outcome === "succeeded") opening = false;
  }
  const end = clientGatewayTraceStateEndCheck(recording, walker);
  const verdict = clientGatewayTraceStateVerdict({ recording, end, gaps });
  const recordedActs = recording.entries.filter((entry) => entry.kind === "act" && entry.reading.outcome === "succeeded").length;
  return {
    tally,
    verdict: Object.freeze({
      verdict: verdict.verdict,
      reasons: verdict.reasons,
      firstGap,
      recordedActs,
      usedActs: end.used.length,
      receiptedActs: end.receipted.length,
      skippedActs: end.skipped.length,
      skippedLayerActs: end.skipped.filter((index) => recording.entries[index]!.oneTimeLayer).length,
    }),
  };
}
