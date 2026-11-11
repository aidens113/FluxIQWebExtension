// A Next page step's press above humanness 0 (W2, t908): the pager's control
// pressed as the click verb presses (`../../actions/click.ts`), so a list moved
// page by page is pressed as a person presses it.
//
// - The aim (`./aim-press.ts`): a point near the control's centre, used only
//   when the gate accepts it -- inside the control's visible box, landing on it
//   under the gate's own hit test. Otherwise the press is `control.click()`,
//   exactly the press made at humanness 0, and the record says it was not aimed.
// - The misclick (`./misclick/before.ts`): only on a command Core marked safe
//   (`humannessMisclick`), at most once a step, before its first press, and
//   only where every line that file keeps holds: no robot check, nothing open
//   over the page, and an inert point beside the control, never a control.
//   Unmarked, a pager press -- one that could take the page elsewhere -- never
//   misclicks.
// - The record (`./record-humanness.ts`): whether every press the step made was
//   aimed, and the misclick's point. In a document a press loaded, the record is
//   the one the press's mark brought (`../../extraction/page-advance/continued-move.ts`),
//   so a step that was aimed never records otherwise.
//
// At humanness 0 the verb makes none of this, and its step presses with
// `control.click()` as before.

import type { PageMovePress } from "../../../shared/extraction-continuation";
import type { PagerPress } from "../../extraction/page-advance/pager-press";
import type { ActionabilityReport } from "../actionability";
import { dispatchClickGesture, type ClickPoint } from "../click-gesture";
import { aimPress } from "./aim-press";
import type { CommandHumanness } from "./command-humanness";
import { misclickBefore } from "./misclick";

/** The command fields the press reads. */
type PagerPressCommand = {
  commandId: string;
  humanness?: number | undefined;
  humannessMisclick?: true | undefined;
  timeoutMs?: number | undefined;
  checkWaitMs?: number | undefined;
};

/** What the press is made of: the click verb's own aim, gesture and misclick, which a test stands in. */
type PagerPressParts = {
  aim: typeof aimPress;
  gesture: (element: Element, point: ClickPoint) => unknown;
  misclick: typeof misclickBefore;
};

const PARTS: PagerPressParts = { aim: aimPress, gesture: dispatchClickGesture, misclick: misclickBefore };

/** A step's press, and what the step's result records of it. */
export type HumanPagerPress = PagerPress & {
  /** The step's record: aimed when every press it made (or the press its mark brought) was aimed. */
  record(): PageMovePress;
};

/** The press for a command at `human`'s level; `check` is the actionability gate the click verb presses by. */
export function humanPagerPress(
  action: PagerPressCommand,
  human: CommandHumanness,
  startedAt: number,
  check: (element: Element) => ActionabilityReport,
  parts: PagerPressParts = PARTS
): HumanPagerPress {
  // The first press's decision, made in `prepare` and used by that press alone, so the mark says what the press does.
  let prepared: { control: HTMLElement; point: ClickPoint | undefined; pending: boolean } | undefined;
  let misclick: { x: number; y: number } | undefined;
  let aimed: boolean | undefined;
  let carried: PageMovePress | undefined;

  const aimAt = (control: HTMLElement): ClickPoint | undefined => {
    const gate = check(control);
    return gate.actionable ? parts.aim(control, gate, human)?.point : undefined;
  };
  const withMisclick = (record: { aimed: boolean }): PageMovePress => (misclick === undefined ? record : { ...record, misclick: { x: misclick.x, y: misclick.y } });

  return {
    async prepare(control) {
      if (prepared !== undefined) return;
      prepared = { control, point: undefined, pending: false };
      if (action.humannessMisclick === true) await parts.misclick(control, action, startedAt, (point) => (misclick = point));
      // Aimed after the misclick, on the control as it then stands.
      prepared = { control, point: aimAt(control), pending: true };
    },
    press(control) {
      // The prepared decision serves the first press only; a press made once more is aimed afresh.
      const first = prepared?.pending === true && prepared.control === control;
      const point = first ? prepared?.point : aimAt(control);
      if (prepared !== undefined) prepared = { ...prepared, pending: false };
      if (point === undefined) {
        control.click();
        aimed = false;
        return;
      }
      parts.gesture(control, point);
      aimed = aimed ?? true;
    },
    marked() {
      if (prepared === undefined) return undefined;
      return withMisclick({ aimed: aimed ?? prepared.point !== undefined });
    },
    resumed(press) {
      carried = { ...press };
    },
    record() {
      if (carried !== undefined && aimed === undefined) return carried;
      return withMisclick({ aimed: aimed === true });
    }
  };
}
