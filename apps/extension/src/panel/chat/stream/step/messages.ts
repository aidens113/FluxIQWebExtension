// Core's activity events as FluxIQ's own messages in the chat, one per thing
// it decided or checked, each with its reason. No DOM.
//
// What becomes a message, in the order the events arrived:
//
//   decision  a `thought` with text: Core's model chose an action and said
//             why. "Clicking “Get a free quote”" with "The quote form is
//             behind this button, so I'm opening it."
//   repair    a `thought` while Core repairs the Flow: its diagnosis
//   check     a `check`: the result check and its verdict
//   step      a run's step ("Step 2 of 5: Open results"), and a build's
//             failure marker
//   ask, note what Core asked the person, or noted, in words
//   action    an action with no decision before it (a Core that does not
//             explain its steps yet): the action itself, in words
//
// Not a message: a pure status change, a decision still being made
// ("Deciding the next step", no text: the live line says it), a build's
// start and finish markers (the live line and the answer say those), and
// Core's own bookkeeping (`isInternalStep`).
//
// An action (`tool`) that follows a decision is that decision's outcome, not
// a message: it updates the decision's quiet outcome line as it starts and
// ends. A decision carries one action; a second one, or one with no decision
// before it, is its own `action` message. A check or an action that started
// is updated in place when it ends. A run step Core never ends is over once
// anything later happens in its unit of work.
//
// Keys come from the event that opened a message (`activityId#sequence`), so
// a message keeps its element for as long as it is on screen. Every word
// comes from `stepWords`, never a raw id.

import { isInternalStep, type ClientGatewayActivity } from "../../../../shared/activity/index";
import { stepWords } from "./words";

type ActivityDetail = NonNullable<ClientGatewayActivity["detail"]>;
type Status = NonNullable<ActivityDetail["status"]>;

/** What a message is. */
export type StepMessageKind = "decision" | "repair" | "check" | "step" | "ask" | "note" | "action";

/** How the action a message stands for went; `text` is Core's sentence about it, in words. */
export type StepOutcome = { status: Status; text: string | undefined };

/** One of FluxIQ's step messages. */
export type StepMessage = {
  /** `step:<activityId>#<sequence>` of the event that opened it: stable for its life. */
  key: string;
  /** The unit of work it belongs to (`ClientGatewayActivity.activityId`). */
  activityId: string;
  kind: StepMessageKind;
  /** What FluxIQ is doing, in words. */
  title: string;
  /** Why, or the verdict, in Core's words; undefined when there is none. */
  text: string | undefined;
  /** The action's outcome; null for a message that stands for no action. */
  outcome: StepOutcome | null;
  /** The time of the event that opened it, in ms. */
  at: number;
  /** The last event folded into it. */
  sequence: number;
  /** True for the newest message of its unit of work. */
  latest: boolean;
};

type Unit = {
  /** The decision the next action belongs to, while it has none. */
  decision: number | undefined;
  /** Actions and checks that started and have not ended, by identity. */
  open: Map<string, number>;
  /** A run step Core started and will not end. */
  step: number | undefined;
};

/** The messages for `events` (oldest first), at most `limit` of them, the newest. */
export function stepMessages(events: readonly ClientGatewayActivity[], limit: number): StepMessage[] {
  const drafts: StepMessage[] = [];
  const units = new Map<string, Unit>();
  let lastAt = Number.NEGATIVE_INFINITY;

  const add = (event: ClientGatewayActivity, detail: ActivityDetail, kind: StepMessageKind, at: number, outcome: StepOutcome | null): number => {
    const words = stepWords(detail, event.step);
    drafts.push({
      key: `step:${event.activityId}#${event.sequence}`,
      activityId: event.activityId,
      kind,
      title: words.title,
      text: words.text,
      outcome,
      at,
      sequence: event.sequence,
      latest: false
    });
    return drafts.length - 1;
  };

  for (const event of events) {
    const parsed = Date.parse(event.at);
    const at = Number.isFinite(parsed) ? parsed : lastAt;
    lastAt = at;
    let unit = units.get(event.activityId);
    if (unit === undefined) {
      unit = { decision: undefined, open: new Map(), step: undefined };
      units.set(event.activityId, unit);
    }
    if (unit.step !== undefined) {
      const over = drafts[unit.step]!;
      if (over.outcome?.status === "started") over.outcome = { ...over.outcome, status: "succeeded" };
      over.sequence = Math.max(over.sequence, event.sequence);
      unit.step = undefined;
    }
    const detail = event.detail;
    if (detail === undefined || isInternalStep(detail)) continue;
    const status = detail.status;
    const words = stepWords(detail, event.step);

    if (detail.kind === "thought") {
      if (words.text === undefined) continue;
      unit.decision = add(event, detail, event.phase === "repairing" ? "repair" : "decision", at, null);
      continue;
    }

    if (detail.kind === "tool" || detail.kind === "check") {
      const identity = `${detail.kind}|${detail.ref ?? detail.title}`;
      const owner = unit.open.get(identity);
      const outcome: StepOutcome = { status: status ?? "succeeded", text: detail.kind === "tool" ? words.text : undefined };
      let placed: number;
      if (owner !== undefined) {
        const draft: StepMessage = drafts[owner]!;
        draft.outcome = outcome;
        draft.sequence = event.sequence;
        if (draft.kind !== "decision" && draft.kind !== "repair") {
          draft.title = words.title;
          if (draft.kind === "check") draft.text = words.text ?? draft.text;
        }
        placed = owner;
      } else if (detail.kind === "tool" && unit.decision !== undefined) {
        placed = unit.decision;
        const draft = drafts[placed]!;
        draft.outcome = outcome;
        draft.sequence = event.sequence;
      } else {
        placed = add(event, detail, detail.kind === "tool" ? "action" : "check", at, outcome);
      }
      unit.decision = undefined;
      if (status === "started") unit.open.set(identity, placed);
      else unit.open.delete(identity);
      continue;
    }

    unit.decision = undefined;
    if (detail.kind === "step") {
      const marker = event.step === undefined;
      // A build's start and finish say nothing the live line and the answer do not.
      if (marker && event.subject.kind === "build" && status !== "failed") continue;
      const placed = add(event, detail, "step", at, marker ? null : { status: status ?? "succeeded", text: undefined });
      if (!marker && status === "started") unit.step = placed;
      continue;
    }
    add(event, detail, detail.kind, at, null);
  }

  const kept = limit > 0 ? drafts.slice(-limit) : [];
  const newest = new Map<string, StepMessage>();
  for (const draft of kept) newest.set(draft.activityId, draft);
  return kept.map((message) => ({ ...message, latest: newest.get(message.activityId) === message }));
}
