// An action card in words, for its view and for anyone who cannot see it:
//
//   name     Core's short name for the kind ("Click", "Robot check"); for a
//            step of a test run, "Testing: Click", since the step is named by
//            its action and the test is what it was part of: every test step
//            read "Test run · ×" (t174-w85 D4, `run-murwd8le-79e735a8`)
//   target   what it acted on or looked for: the control's name Core gave, or
//            the words a look searched for; nothing when Core named none. It
//            never says "the page": "Click · the page" and "Action · the
//            page" said nothing a person could tell apart (t193,
//            `run-muqiojz4-04a7a8fc`), and the message above the card says
//            what the step did
//   outcome  "Working on it" and "Waiting for you" only while it is the
//            action of the moment (the newest of work still under way);
//            "Done", "Passed", "Didn't work: it wasn't on the page",
//            "Didn't pass: no price was shown"; "Not confirmed: ..." for a
//            result check Core could not confirm, which is no failure: an
//            unverified run that met its task read "Didn't pass" in red
//            (t174-w85 D1); for a wait on the person
//            that Core settled, its sentence: "Done. You pressed Continue.",
//            "Didn't work: you pressed Stop"; nothing for an action that
//            never said it ended once the work moved on
//   label    all three in one line, for the card's accessible name
//
// `state` drives the card's mark: `settled` is an action that never said how
// it went, and `unconfirmed` a result check that neither passed nor failed,
// which takes no failure's colour. No DOM.

import { ACTIVITY_ACTION_NAMES } from "fluxiq/ui";
import type { ActionCard } from "./action-card";

/** The card's words and the state its mark shows. */
export type CardWords = {
  state: "working" | "waiting" | "done" | "failed" | "unconfirmed" | "settled";
  name: string;
  target: string | null;
  outcome: string | null;
  label: string;
};

/** `card` in words; `current` is true while it is the action of the moment. */
export function cardWords(card: ActionCard, current: boolean): CardWords {
  const kind = ACTIVITY_ACTION_NAMES[card.kind] ?? ACTIVITY_ACTION_NAMES.other;
  const name = card.testing ? `Testing: ${kind}` : kind;
  const target = card.target;
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
      if (card.unconfirmed) return ["unconfirmed", joined("Not confirmed", card.said)];
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
