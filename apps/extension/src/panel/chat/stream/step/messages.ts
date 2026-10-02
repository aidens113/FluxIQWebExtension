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
// start and finish markers (the live line and the answer say those), a note
// with no words, and Core's own bookkeeping (`isInternalStep`). A note with no
// words is a call Core made for itself -- the look before the first decision,
// the dry run putting the page back -- which the live line says while it
// runs; as a message it was a bare heading, twice, once as it started and
// once as it ended (live runs 34 and 35: "Looking at the page").
// What the person asked the work (`request`) is their message, not a step
// (`../stream-items.ts`).
//
// Every action is a card (`actionCard`): an icon for its kind, what it acted
// on, and how it went. The actions (`tool`) a decision led to are that
// decision's cards, in the order they happened, until something else opens a
// message. An action with no decision before it (a Core that does not explain
// its steps yet) is an `action` message that is only its card. A check, a
// question to the person (a robot check or a permission) and a run's step
// are each a message with its own card. A card that started is updated in
// place when it ends. A run step Core never ends is over once anything later
// happens in its unit of work: failed when that is the run's recovery from
// that step or the run failing, done otherwise.
//
// A card waiting on the person (a robot check, a permission) is over only
// when Core says so: the ask row that settles the wait carries the same ask
// id (`activityActionKey`: `ask:<ref>`) and a `resolution`, and the card is
// marked from it in place, the same element in the same place. Nothing later
// in the work settles it, so a wait Core never settles stays waiting. One
// check is one card: a tool whose result says the page needs a person (Core's
// reading is a robot check, waiting) and the robot-check ask of the same unit
// of work are joined, whichever came first, and the second updates the first
// card in place. An ask row that names no ask id while another ask's card is
// waiting only restates that wait (a parked run's "Run is waiting for an
// answer") and adds nothing. The rules match the Core panel's
// (`apps/web/.../conversation/activity/steps/messages.ts` in FluxIQ Core).
//
// Keys come from the event that opened a message (`step:activityId#sequence`)
// or a card (`action:activityId#sequence`), so each keeps its element for as
// long as it is on screen and never moves. Every word comes from `stepWords`
// or Core's shared reading of the action, never a raw id.

import { activityActionKey } from "fluxiq/ui";
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
  /** The node that run step ran (its `detail.ref`), so the row that says it failed can be told from any later row. */
  stepNode: string | undefined;
  /** Each ask's card, by its ask id (`activityActionKey`), so the row that settles it finds it. */
  asks: Map<string, Place>;
  /** A robot-check card still waiting for its other half: the ask, or the tool that met the check. */
  check: { place: Place; from: "ask" | "tool" } | undefined;
};

/** A robot check still waiting on the person: the only card the other half of a check joins. */
function waitsOnPerson(card: Pick<ActionCard, "kind" | "outcome">): boolean {
  return card.kind === "person_check" && card.outcome === "waiting";
}

/**
 * Whether `event`, the row after a run step Core started, says that step
 * failed: the run's recovery from a failed step names the node it recovers
 * (`ref`, `executor/graph-run.ts` in Core), and a run that fails ends on its
 * final `failed` row.
 */
function stepFailedBy(event: ClientGatewayActivity, node: string | undefined): boolean {
  if (event.phase === "failed") return true;
  return event.phase === "repairing" && node !== undefined && event.detail?.ref === node;
}

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
  const cardAt = (place: Place): ActionCard => drafts[place.message]!.actions[place.card]!;
  /** Marks the card at `place` from `next` in place: its key never changes, and a kind or a name it had is kept. */
  const mark = (place: Place, next: ActionCard, sequence: number): void => {
    const draft = drafts[place.message]!;
    const before = cardAt(place);
    draft.actions[place.card] = { ...next, key: before.key, kind: next.kind === "other" ? before.kind : next.kind, target: next.target ?? before.target };
    draft.sequence = Math.max(draft.sequence, sequence);
  };
  /** The unit's robot-check card waiting for the other half named by `from`, while it still waits. */
  const joinable = (unit: Unit, from: "ask" | "tool"): Place | undefined => {
    const check = unit.check;
    return check?.from === from && waitsOnPerson(cardAt(check.place)) ? check.place : undefined;
  };

  for (const event of events) {
    const parsed = Date.parse(event.at);
    const at = Number.isFinite(parsed) ? parsed : lastAt;
    lastAt = at;
    let unit = units.get(event.activityId);
    if (unit === undefined) {
      unit = { decision: undefined, open: new Map(), step: undefined, stepNode: undefined, asks: new Map(), check: undefined };
      units.set(event.activityId, unit);
    }
    if (unit.step !== undefined) {
      const over = drafts[unit.step]!;
      // Core never ends a run step, so the next row of its unit does -- and
      // says how. A recovery for that same node, or the run itself failing, is
      // the step failing: a press that did not work read "Done" just above
      // "Run failed" (U-A1, `run-muq6lqnw-fdfa7aac`). Anything else is the run
      // moving on past a step that worked.
      const outcome = stepFailedBy(event, unit.stepNode) ? "failed" : "done";
      over.actions = over.actions.map((card) => (card.outcome === "working" ? { ...card, outcome } : card));
      over.sequence = Math.max(over.sequence, event.sequence);
      unit.step = undefined;
      unit.stepNode = undefined;
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
      const identity = activityActionKey(event) ?? `${detail.kind}:${detail.title}`;
      const owner = unit.open.get(identity);
      const met = detail.kind === "tool" ? actionCard(event, cardKey(event)) : null;
      const asked = met !== null && waitsOnPerson(met) ? joinable(unit, "ask") : undefined;
      if (met !== null && asked !== undefined) {
        // The check the ask already waits on: its card, not a second one. The
        // ask says how it ends, so the card keeps what the ask said.
        const ask = cardAt(asked);
        mark(asked, { ...ask, target: ask.target ?? met.target }, event.sequence);
        unit.check = undefined;
        unit.open.delete(identity);
        unit.decision = undefined;
        continue;
      }
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
      if (met !== null && waitsOnPerson(met)) unit.check = { place: placed, from: "tool" };
      continue;
    }

    if (detail.kind === "ask") {
      const card = actionCard(event, cardKey(event));
      const key = activityActionKey(event);
      const known = key === null ? undefined : unit.asks.get(key);
      if (known !== undefined) {
        // The row that settles the wait, or one that says it again: the same card.
        if (card !== null) mark(known, card, event.sequence);
        if (unit.check?.place === known && !waitsOnPerson(cardAt(known))) unit.check = undefined;
        continue;
      }
      if (key === null && [...unit.asks.values()].some((place) => cardAt(place).outcome === "waiting")) continue;
      const reasoning = unit.decision;
      unit.decision = undefined;
      if (card === null) {
        add(event, detail, "ask", at, null);
        continue;
      }
      const tool = card.kind === "person_check" ? joinable(unit, "tool") : undefined;
      let placed: Place;
      if (tool !== undefined) {
        // The tool already met this check: the ask takes over its card.
        mark(tool, card, event.sequence);
        placed = tool;
        unit.check = undefined;
      } else if (reasoning !== undefined) {
        // Like an action, the ask is a card under the reasoning that led to
        // it, as the Core panel shows it; a message of its own only when no
        // reasoning came before it in this unit.
        const draft = drafts[reasoning]!;
        draft.actions.push(card);
        draft.sequence = event.sequence;
        placed = { message: reasoning, card: draft.actions.length - 1 };
        if (waitsOnPerson(card)) unit.check = { place: placed, from: "ask" };
      } else {
        placed = { message: add(event, detail, "ask", at, card), card: 0 };
        if (waitsOnPerson(card)) unit.check = { place: placed, from: "ask" };
      }
      if (key !== null) unit.asks.set(key, placed);
      continue;
    }

    unit.decision = undefined;
    if (detail.kind === "step") {
      const marker = event.step === undefined;
      // A build's start and finish say nothing the live line and the answer do
      // not. Nor does a failed finish when the build was started from a chat:
      // the chat's command writes how the build ended, and how far it got, into
      // that thread as its answer, so the marker said the same ending twice
      // (U-B2, in every chat-driven Lab run). A build started anywhere else has
      // no answer in a thread, and its failure is said here.
      if (marker && event.subject.kind === "build" && (status !== "failed" || event.conversationId !== undefined)) continue;
      const placed = add(event, detail, "step", at, marker ? null : actionCard(event, cardKey(event)));
      if (!marker && status === "started") {
        unit.step = placed;
        unit.stepNode = detail.ref;
      }
      continue;
    }
    if (detail.kind === "note" && words.text === undefined) continue;
    add(event, detail, detail.kind, at, null);
  }

  const kept = limit > 0 ? drafts.slice(-limit) : [];
  const newest = new Map<string, StepMessage>();
  for (const draft of kept) newest.set(draft.activityId, draft);
  return kept.map((message) => ({ ...message, actions: [...message.actions], latest: newest.get(message.activityId) === message }));
}
