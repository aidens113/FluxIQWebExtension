// Whether a page turn landed by what the page showed, and if so, remembering
// the lists it moved (t1096), so their reads stand where it took them, a path's
// page included (`./list-pages.ts`).
//
// A Next page step that answered says itself where its list went
// (`pagerAnswered`, t1022). The page settles the rest:
//
//  - a page turn whose answer was lost and which the page check found landed
//    (`lastingAct: "landed"`, `../retries/page-effect.ts`);
//  - a press on a list's detected Next that answered without saying where the
//    list went, whose page then moved as a page turn moves it: the address,
//    the current mark or the first row (`../retries/page-move.ts`).
//
// `turns` are the lists the command turns (`./turned-lists.ts`); nothing is
// remembered for a command that turns none.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebNodeRun } from "../context";
import { webNodePageMove } from "../retries";
import { webNodeListPages } from "./list-pages";

/** How the act came back: how Core settled a lost answer, whether it is a press that answered, and the pages it found and left. */
export type WebNodeTurnOutcome = {
  lastingAct: "landed" | "uncertain" | undefined;
  answeredPress: boolean;
  found: WebLlmSnapshotBinding | undefined;
  after: WebLlmSnapshotBinding | undefined;
};

/** Remember `turns` as moved when the page showed the turn landed (header). */
export function webNodeListsTurned(run: Pick<WebNodeRun, "stores" | "request" | "sessionId">, turns: readonly string[] | undefined, act: WebNodeTurnOutcome): void {
  if (turns === undefined || turns.length === 0) return;
  const moved = act.lastingAct === "landed" || (act.answeredPress && act.found !== undefined && act.after !== undefined && webNodePageMove(act.found, act.after, true) === "landed");
  if (moved) webNodeListPages(run).turned(turns);
}
