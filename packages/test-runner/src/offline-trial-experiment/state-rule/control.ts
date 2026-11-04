// The control: one Flow's two live runs, position by position, read the way the
// simulation study read them. It says how much a Flow differs from itself with the site
// and nothing else changed, which is as close as any simulation can be asked to get.

import type { ClientGatewayTraceStateDomain, ClientGatewayTraceStateRecordedCall } from "fluxiq/client-gateway";
import { sameRows, selectorOverlap, SELECTORS_CLOSE_AT, SELECTORS_VERY_CLOSE_AT, snapshotSelectors } from "./answer-comparison.js";
import type { ControlTally } from "./types.js";

const SNAPSHOT = "web.dom.capture_snapshot";

export function emptyControlTally(): ControlTally {
  return {
    positions: 0, keySame: 0, statusSame: 0, statusDiffer: 0, snapshotUrlSame: 0, snapshotUrlDiffer: 0, selectorsClose: 0, selectorsFar: 0, selectorsVeryClose: 0, selectorsEqual: 0, rowsSame: 0, rowsDiffer: 0,
    statusSameActs: 0, statusDifferActs: 0, statusSameMoves: 0, statusDifferMoves: 0, statusSameLayerActs: 0, statusDifferLayerActs: 0,
  };
}

export function flowControl(left: readonly ClientGatewayTraceStateRecordedCall[], right: readonly ClientGatewayTraceStateRecordedCall[], domain: ClientGatewayTraceStateDomain): ControlTally {
  const tally = emptyControlTally();
  let readBefore: ClientGatewayTraceStateRecordedCall["answer"] = null;
  for (let position = 0; position < Math.min(left.length, right.length); position += 1) {
    const a = left[position]!;
    const b = right[position]!;
    tally.positions += 1;
    if (a.operation.key === b.operation.key) tally.keySame += 1;
    const readA = domain.readAnswer(a.answer);
    const readB = domain.readAnswer(b.answer);
    const same = readA.outcome === readB.outcome;
    if (same) tally.statusSame += 1;
    else tally.statusDiffer += 1;
    const kind = domain.labelCall(a.operation);
    if (kind === "act") {
      if (same) tally.statusSameActs += 1;
      else tally.statusDifferActs += 1;
      if (domain.isOneTimeLayerAct(a.operation, readBefore)) {
        if (same) tally.statusSameLayerActs += 1;
        else tally.statusDifferLayerActs += 1;
      }
    } else if (kind === "page_move") {
      if (same) tally.statusSameMoves += 1;
      else tally.statusDifferMoves += 1;
    } else if (a.answer !== null) readBefore = a.answer;
    if (a.operation.actionType === SNAPSHOT && b.operation.actionType === SNAPSHOT) {
      if (readA.position === readB.position) tally.snapshotUrlSame += 1;
      else tally.snapshotUrlDiffer += 1;
      const selectorsA = snapshotSelectors(a.answer);
      const selectorsB = snapshotSelectors(b.answer);
      if (selectorsA !== null && selectorsB !== null) {
        const overlap = selectorOverlap(selectorsA, selectorsB);
        if (overlap === 1) tally.selectorsEqual += 1;
        if (overlap >= SELECTORS_VERY_CLOSE_AT) tally.selectorsVeryClose += 1;
        if (overlap >= SELECTORS_CLOSE_AT) tally.selectorsClose += 1;
        else tally.selectorsFar += 1;
      }
    }
    const rows = sameRows(readA, readB);
    if (rows === true) tally.rowsSame += 1;
    if (rows === false) tally.rowsDiffer += 1;
  }
  return tally;
}
