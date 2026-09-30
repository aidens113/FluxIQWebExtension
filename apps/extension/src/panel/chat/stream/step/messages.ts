// Core's activity events as FluxIQ's own messages in the chat, one per thing
// it decided, did or checked: its reason in words, and the actions it took as
// cards. No DOM.
//
// What becomes a message, in the order the events arrived:
//
//   decision  a `thought` with text: Core's model chose an action and said
//             why. "Clicking “Get a free quote”" with "The quote form is
//             behind this button, so I'm opening it."
//   repair    a `thought` while Core repairs the Flow: its diagnosis
//   check     a `check`: the result check, its card saying the verdict
//   step      a run's step ("Step 2 of 5: Open results"), its card saying
//             how it went, and a build's failure marker
//   ask       what Core asked the person: a card waiting on them
//   note      what Core noted, in words
//   action    an action with no decision before it (a Core that does not
//             explain its steps yet): its card
//
// Not a message: a pure status change, a decision still being made
// ("Deciding the next step", no text: the live line says it), a build's
// start and finish markers (the live line and the answer say those), and
// Core's own bookkeeping (`isInternalStep`).
//
// Every action is a card (`actionCard`): an icon for its kind, what it acted
// on, and how it went. The actions (`tool`) a decision led to are that
// decision's cards, in the order they happened, until something else opens a
// message. An action with no decision before it (a Core that does not explain
// its steps yet) is an `action` message that is only its card. A check, a
// question to the person (a robot check or a permission) and a run's step
// are each a message with its own card. A card that started is updated in
// place when it ends. A run step Core never ends is over once anything later
// happens in its unit of work.
//
// Keys come from the event that opened a message (`step:activityId#sequence`)
// or a card (`action:activityId#sequence`), so each keeps its element for as
// long as it is on screen and never moves. Every word comes from `stepWords`
// or Core's shared reading of the action, never a raw id.

import { isInternalStep, type ClientGatewayActivity } from "../../../../shared/activity/index";
import { actionCard, type ActionCard } from "./action-card";
import { stepWords } from "./words";

type ActivityDetail = NonNullable<ClientGatewayActivity["detail"]>;

/** What a message is. */
export type StepMessageKind = "decision" | "repair" | "check" | "step" | "ask" | "note" | "action";

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
  /** The actions it stands for or led to, as cards, in the order they happened; empty for none. */
  actions: ActionCard[];
  /** The time of the event that opened it, in ms. */
  at: number;
  /** The last event folded into it. */
  sequence: number;
  /** True for the newest message of its unit of work. */
  latest: boolean;
};

/** Where a card lives: its message and its place among the message's cards. */
type Place = { message: number; card: number };

type Unit = {
  /** The decision the next actions belong to, until something else opens a message. */
  decision: number | undefined;
  /** Actions and checks that started and have not ended, by identity. */
  open: Map<string, Place>;
  /** A run step Core started and will not end. */
  step: number | undefined;
};

/** The messages for `events` (oldest first), at most `limit` of them, the newest. */
export function stepMessages(events: readonly ClientGatewayActivity[], limit: number): StepMessage[] {
  const drafts: StepMessage[] = [];
  const units = new Map<string, Unit>();
  let lastAt = Number.NEGATIVE_INFINITY;

  const add = (event: ClientGatewayActivity, detail: ActivityDetail, kind: StepMessageKind, at: number, card: ActionCard | null): number => {
    const words = stepWords(detail, event.step);
    drafts.push({
      key: `step:${event.activityId}#${event.sequence}`,
      activityId: event.activityId,
      kind,
      title: words.title,
      text: words.text,
      actions: card === null ? [] : [card],
      at,
      sequence: event.sequence,
      latest: false
    });
    return drafts.length - 1;
  };
  const cardKey = (event: ClientGatewayActivity): string => `action:${event.activityId}#${event.sequence}`;

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
      over.actions = over.actions.map((card) => (card.outcome === "working" ? { ...card, outcome: "done" } : card));
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
      let placed: Place;
      if (owner !== undefined) {
        const draft: StepMessage = drafts[owner.message]!;
        const before = draft.actions[owner.card];
        const card = actionCard(event, before?.key ?? cardKey(event));
        if (card !== null && before !== undefined) draft.actions[owner.card] = card;
        draft.sequence = event.sequence;
        if (draft.kind !== "decision" && draft.kind !== "repair") {
          draft.title = words.title;
          if (draft.kind === "check") draft.text = words.text ?? draft.text;
        }
        placed = owner;
      } else {
        const card = actionCard(event, cardKey(event));
        if (detail.kind === "tool" && unit.decision !== undefined && card !== null) {
          const draft = drafts[unit.decision]!;
          draft.actions.push(card);
          draft.sequence = event.sequence;
          placed = { message: unit.decision, card: draft.actions.length - 1 };
        } else {
          placed = { message: add(event, detail, detail.kind === "tool" ? "action" : "check", at, card), card: 0 };
        }
      }
      if (detail.kind === "check") unit.decision = undefined;
      if (status === "started") unit.open.set(identity, placed);
      else unit.open.delete(identity);
      continue;
    }

    unit.decision = undefined;
    if (detail.kind === "step") {
      const marker = event.step === undefined;
      // A build's start and finish say nothing the live line and the answer do not.
      if (marker && event.subject.kind === "build" && status !== "failed") continue;
      const placed = add(event, detail, "step", at, marker ? null : actionCard(event, cardKey(event)));
      if (!marker && status === "started") unit.step = placed;
      continue;
    }
    add(event, detail, detail.kind, at, detail.kind === "ask" ? actionCard(event, cardKey(event)) : null);
  }

  const kept = limit > 0 ? drafts.slice(-limit) : [];
  const newest = new Map<string, StepMessage>();
  for (const draft of kept) newest.set(draft.activityId, draft);
  return kept.map((message) => ({ ...message, actions: [...message.actions], latest: newest.get(message.activityId) === message }));
}
