// An action card in words, for its view and for anyone who cannot see it:
//
//   name     Core's short name for the kind ("Click", "Robot check")
//   target   what it acted on: the control's name Core gave, or "the page"
//            for an action on the page that named none; nothing for an
//            action that is not on a control (a test run, an edit to the Flow)
//   outcome  "Working on it" and "Waiting for you" only while it is the
//            action of the moment (the newest of work still under way);
//            "Done", "Passed", "Didn't work: it wasn't on the page",
//            "Didn't pass: no price was shown"; for a wait on the person
//            that Core settled, its sentence: "Done. You pressed Continue.",
//            "Didn't work: you pressed Stop"; nothing for an action that
//            never said it ended once the work moved on
//   label    all three in one line, for the card's accessible name
//
// `state` drives the card's mark: `settled` is an action that never said how
// it went. No DOM.

import { ACTIVITY_ACTION_NAMES, type ActivityActionKind } from "fluxiq/ui";
import type { ActionCard } from "./action-card";

/** The card's words and the state its mark shows. */
export type CardWords = {
  state: "working" | "waiting" | "done" | "failed" | "settled";
  name: string;
  target: string | null;
  outcome: string | null;
  label: string;
};

/** Kinds that act on the page, so a card with no control's name says "the page". */
const ON_THE_PAGE: ReadonlySet<ActivityActionKind> = new Set<ActivityActionKind>(["click", "type", "read", "other"]);

/** `card` in words; `current` is true while it is the action of the moment. */
export function cardWords(card: ActionCard, current: boolean): CardWords {
  const name = ACTIVITY_ACTION_NAMES[card.kind] ?? ACTIVITY_ACTION_NAMES.other;
  const target = card.target ?? (ON_THE_PAGE.has(card.kind) ? "the page" : null);
  const [state, outcome] = outcomeOf(card, current);
  const label = [target === null ? name : `${name}, ${target}`, outcome].filter((part) => part !== null).join(": ");
  return { state, name, target, outcome, label };
}

function outcomeOf(card: ActionCard, current: boolean): [CardWords["state"], string | null] {
  switch (card.outcome) {
    case "working":
      return current ? ["working", "Working on it"] : ["settled", null];
    case "waiting":
      // Only Core's resolved row ends a wait (`resolution`, including
      // `cancelled` when the work stops first), never the work moving on.
      return ["waiting", "Waiting for you"];
    case "done":
      if (card.answer !== undefined) return ["done", `Done. ${card.answer}`];
      return ["done", joined(card.check ? "Passed" : "Done", card.check ? card.said : undefined)];
    case "failed":
      if (card.why === null && card.answer !== undefined) return ["failed", `Didn't work. ${card.answer}`];
      return ["failed", joined(card.check ? "Didn't pass" : "Didn't work", card.why ?? card.said)];
  }
}

function joined(head: string, reason: string | null | undefined): string {
  const said = reason?.trim();
  return said ? `${head}: ${lowerFirst(said)}` : head;
}

/** "The field was covered." reads "the field was covered." after a colon; "URL" or "PIN" stays as it is. */
function lowerFirst(sentence: string): string {
  const [first, second] = [sentence.charAt(0), sentence.charAt(1)];
  return second !== "" && second === second.toLowerCase() && second !== second.toUpperCase() ? first.toLowerCase() + sentence.slice(1) : sentence;
}
