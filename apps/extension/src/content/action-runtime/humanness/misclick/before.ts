// One misclick before a press, at a humanness above 0 (W2 H4).
//
// A person sometimes clicks just beside what they meant and clicks again. The
// click verb asks for that here before its press (`../../../actions/click.ts`),
// and it happens only when every one of these holds:
//
//  - Core marked the command (`humannessMisclick: true`). Core sends the mark
//    only above humanness 0, on a step that declared an empty consequence list
//    and that nothing marks as acting on the world (Core's
//    `engine/automation/node-execution/attempt.ts`). Unmarked, nothing here
//    reads the page;
//  - the command's level is above 0 (`../command-humanness.ts`);
//  - the command's own seeded draw falls under the chance for its level
//    (`chance.ts`, 8% at 100), from a generator of its own
//    (`random.ts`), so the press's H3 aim is the same either way;
//  - the page shows no robot check (`../../challenge-evidence.ts`, only read:
//    the check-wait code is untouched);
//  - nothing is open over the page (`open-layer.ts`): no dialog, popover,
//    menu, listbox or covering layer, which an outside click would close;
//  - an inert point is found beside the target (`point.ts`,
//    `inert-point.ts`).
//
// Then the gesture a press makes (`../../click-gesture.ts`) is dispatched once at
// that point, on what lies there, followed by the short pause a person takes
// to see the miss, fitted within the command's own time
// (`../fit-within-command.ts`). At most one misclick per command, always before
// the press. The verb then presses exactly as it would have -- unless the
// misclick changed something after all (the target left the page or moved, or
// a layer opened): the answer is then `moved`, and the verb measures its target
// again before pressing.

import { robotCheckIn } from "../../challenge-evidence";
import { dispatchClickGesture } from "../../click-gesture";
import { commandHumanness } from "../command-humanness";
import { fitWithinCommand } from "../fit-within-command";
import { misclickChance } from "./chance";
import { misclickPoint } from "./point";
import { misclickRandom } from "./random";
import { pageHasOpenLayer } from "./open-layer";
import { pauseFor } from "../pause-for";

/** The least pause after a misclick before the press, in milliseconds. */
const NOTICE_MIN_MS = 150;

/** How much longer than that it may be, in milliseconds. */
const NOTICE_SPAN_MS = 250;

/** The command fields a misclick reads. */
type MisclickCommand = {
  commandId: string;
  humanness?: number | undefined;
  humannessMisclick?: true | undefined;
  timeoutMs?: number | undefined;
  checkWaitMs?: number | undefined;
};

type Box = { left: number; top: number; right: number; bottom: number };

/** `none`: no misclick. `made`: one, and the page is as it was. `moved`: one, and the target or the page changed, so the press is measured again. */
export async function misclickBefore(target: Element, action: MisclickCommand, startedAt: number): Promise<"none" | "made" | "moved"> {
  if (action.humannessMisclick !== true) return "none";
  const human = commandHumanness(action);
  if (!human) return "none";
  const random = misclickRandom(action.commandId);
  if (!(random() < misclickChance(human.share))) return "none";
  const document = target.ownerDocument;
  if (robotCheckShown(document) || pageHasOpenLayer(document)) return "none";
  const found = misclickPoint(target, random, document);
  if (!found) return "none";
  const before = boxOf(target);
  dispatchClickGesture(found.hit, found.point);
  const [pause = 0] = fitWithinCommand([NOTICE_MIN_MS + random() * NOTICE_SPAN_MS], action, startedAt);
  await pauseFor(pause);
  return target.isConnected && sameBox(before, boxOf(target)) && !pageHasOpenLayer(document) ? "made" : "moved";
}

/** Whether the page shows a robot check; `true` when it cannot be read. */
function robotCheckShown(document: Document): boolean {
  try {
    return !document.body || robotCheckIn(document.body, "page") !== undefined;
  } catch {
    return true;
  }
}

function boxOf(element: Element): Box {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
}

function sameBox(a: Box, b: Box): boolean {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}
