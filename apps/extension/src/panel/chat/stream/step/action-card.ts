// One action FluxIQ took, ready for its card in the chat: Core's shared
// reading of the event (`activityActionOf` in `fluxiq/ui`: the kind that
// picks the icon and the card's name, what it acted on, where it stands, and
// why it failed) plus what the chat needs to keep the card in place and say
// it in words. No DOM.
//
// A question to the person (an `ask`) is a card waiting on them: a robot
// check or a permission. Core's own sentence about the action (`said`) is
// kept only when it is in words; a line that names an id or a result code
// ("Result: web.click.succeeded · Node: web.output.dom-click") is not words.

import { activityActionOf, type ActivityAction } from "fluxiq/ui";
import type { ClientGatewayActivity } from "../../../../shared/activity/index";
import { stepWords } from "./words";

/** An action's card. */
export type ActionCard = ActivityAction & {
  /** `action:<activityId>#<sequence>` of the event that opened it: stable for its life. */
  key: string;
  /** Core's sentence about it, in words; undefined when there is none. */
  said: string | undefined;
  /** True for a result check, which passes or does not rather than working or not. */
  check: boolean;
};

/** A dotted id such as `web.output.dom-click` or `core.run_node`, anywhere in a sentence. */
const DOTTED_ID = /\b[a-z][\w-]*(?:\.[\w-]+)+\b/iu;

/** The card for `event`, keyed `key`; null for an event that is no action (a thought, a note, a status). */
export function actionCard(event: ClientGatewayActivity, key: string): ActionCard | null {
  const detail = event.detail;
  if (detail === undefined || detail.kind === "thought" || detail.kind === "note") return null;
  const action = activityActionOf(event);
  if (action === null) return null;
  const said = stepWords(detail, event.step).text;
  return {
    kind: action.kind,
    target: action.target,
    outcome: detail.kind === "ask" && action.outcome === "working" ? "waiting" : action.outcome,
    why: action.why,
    key,
    said: said !== undefined && !DOTTED_ID.test(said) ? said : undefined,
    check: detail.kind === "check"
  };
}
