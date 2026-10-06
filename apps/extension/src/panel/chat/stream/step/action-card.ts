// One action FluxIQ took, ready for its card in the chat: Core's shared
// reading of the event (`activityActionOf` in `fluxiq/ui`: the kind that
// picks the icon and the card's name, what it acted on, where it stands, and
// why it failed) plus what the chat needs to keep the card in place and say
// it in words. No DOM.
//
// Where a card stands comes from `activityActionOf` alone. A question to the
// person (an `ask`: a robot check or a permission) waits on them until Core's
// row that settles it says how it ended (`detail.resolution`); that row's
// sentence ("You pressed Continue.") is the card's `answer`. Nothing here
// reads the resolution's values, so a new one needs no change. Core's own
// sentence about any other action (`said`) is kept only when it is in words;
// a line that names an id or a result code ("Result: web.click.succeeded ·
// Node: web.output.dom-click") is not words. Core's marks that a step was part
// of a test run (`testing`), that a result check could not confirm the
// result (`unconfirmed`), and that Core declined a decision before doing it
// (`refused`: a call refused as a repeat, an edit refused in whole or in
// part, with Core's plain reason) are carried as Core gave them.

import { activityActionOf, type ActivityAction } from "fluxiq/ui";
import type { ClientGatewayActivity } from "../../../../shared/activity/index";
import { stepWords } from "./words";

/** An action's card. */
export type ActionCard = ActivityAction & {
  /** `action:<activityId>#<sequence>` of the event that opened it: stable for its life. */
  key: string;
  /** Core's sentence about it, in words; undefined when there is none, and always for a question to the person. */
  said: string | undefined;
  /** Core's sentence on how a wait on the person ended ("You pressed Continue."); undefined until the row that settles it. */
  answer: string | undefined;
  /** True for a result check, which passes or does not rather than working or not. */
  check: boolean;
  /** How many identical refusals in a row this card stands for (`messages.ts`); absent for one. */
  times?: number;
};

/** A dotted id such as `web.output.dom-click` or `core.run_node`, anywhere in a sentence. */
const DOTTED_ID = /\b[a-z][\w-]*(?:\.[\w-]+)+\b/iu;

/** The card for `event`, keyed `key`; null for an event that is no action (a thought, a note, a status). */
export function actionCard(event: ClientGatewayActivity, key: string): ActionCard | null {
  const detail = event.detail;
  if (detail === undefined || detail.kind === "thought" || detail.kind === "note") return null;
  const action = activityActionOf(event);
  if (action === null) return null;
  const words = stepWords(detail, event.step).text;
  const sentence = words !== undefined && !DOTTED_ID.test(words) ? words : undefined;
  const asked = detail.kind === "ask";
  return {
    kind: action.kind,
    target: action.target,
    outcome: action.outcome,
    why: action.why,
    // What a test of the Flow did with a step it did not simply do again (Core's `activityActionTested`).
    ...(action.tested === undefined ? {} : { tested: action.tested }),
    // What a finished action came to (Core's `ActivityAction.result`: "13 rows from 5 pages", an edit's change), shown after "Done: ".
    ...(action.result === undefined ? {} : { result: action.result }),
    ...(action.testing ? { testing: true as const } : {}),
    ...(action.unconfirmed ? { unconfirmed: true as const } : {}),
    // What Core declined of a decision, and why (Core's `activityActionOf`, t193 1003 C13).
    ...(action.refused === undefined ? {} : { refused: action.refused }),
    key,
    said: asked ? undefined : sentence,
    answer: asked && detail.resolution !== undefined ? sentence : undefined,
    check: detail.kind === "check"
  };
}
