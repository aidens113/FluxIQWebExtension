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
//            what the step did. A long one is cut from the middle, keeping
//            its first word and as many of its last as fit, so the words
//            that tell two cards apart stay on screen: two test cards read
//            "Testing: Click · ValueRidge Everyday Di…", the 3-Pack and the
//            single pack alike (t193 1003, D8). The view cuts at the end
//            when it must, so this keeps the head of the card within what a
//            narrow panel shows
//   outcome  "Working on it" and "Waiting for you" only while it is the
//            action of the moment (the newest of work still under way);
//            "Done", "Passed", "Didn't work: it wasn't on the page",
//            "Didn't pass: no price was shown"; "Not confirmed: ..." for a
//            result check Core could not confirm, which is no failure: an
//            unverified run that met its task read "Didn't pass" in red
//            (t174-w85 D1); for a step of a test of the Flow that it did not
//            simply do again, Core's words for what it did instead: "Checked,
//            not pressed", "Already done on the site", "Skipped: not there,
//            optional" (t193 1002-M, C10: all of them read "Done", and the
//            skipped one "Didn't work"); for a wait on the person
//            that Core settled, its sentence: "Done. You pressed Continue.",
//            "Didn't work: you pressed Stop"; for a decision Core declined
//            before doing it, "Not done: that step is already in the Flow",
//            or "Only partly done: ..." for an edit some of which landed --
//            never "Didn't work", since nothing was tried and failed (t193
//            1003, C13); nothing for an action that never said it ended once
//            the work moved on
//   label    all three in one line, for the card's accessible name, with the
//            whole target
//
// `state` drives the card's mark: `settled` is an action that never said how
// it went, `unconfirmed` a result check that neither passed nor failed, and
// `refused` a decision Core declined, neither of which takes a failure's
// colour. No DOM.

import { ACTIVITY_ACTION_NAMES } from "fluxiq/ui";
import type { ActionCard } from "./action-card";

/** The card's words and the state its mark shows. */
export type CardWords = {
  state: "working" | "waiting" | "done" | "failed" | "unconfirmed" | "refused" | "settled";
  name: string;
  target: string | null;
  outcome: string | null;
  label: string;
};

/**
 * The most characters the card's first line holds, name and target together,
 * before the view would cut it: what the 360-pixel side panel showed of
 * "Testing: Click · ValueRidge Everyday Di…" (t193 1003, D8).
 */
const HEAD_ROOM = 36;
/** The least room a target is given, whatever its name's length. */
const MIN_TARGET_ROOM = 16;
/** What stands for the words a cut leaves out. */
const GAP = " … ";

/** `card` in words; `current` is true while it is the action of the moment. */
export function cardWords(card: ActionCard, current: boolean): CardWords {
  const kind = ACTIVITY_ACTION_NAMES[card.kind] ?? ACTIVITY_ACTION_NAMES.other;
  const name = card.testing ? `Testing: ${kind}` : kind;
  const target = card.target;
  const [state, outcome] = outcomeOf(card, current);
  const label = [target === null ? name : `${name}, ${target}`, outcome].filter((part) => part !== null).join(": ");
  return { state, name, target: target === null ? null : shortened(target, Math.max(MIN_TARGET_ROOM, HEAD_ROOM - name.length)), outcome, label };
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
      if (card.refused !== undefined) return ["done", joined("Only partly done", card.refused.because)];
      if (card.tested !== undefined) return ["done", card.tested];
      return ["done", joined(card.check ? "Passed" : "Done", card.check ? card.said : undefined)];
    case "failed":
      if (card.unconfirmed) return ["unconfirmed", joined("Not confirmed", card.said)];
      if (card.refused !== undefined) return ["refused", joined("Not done", card.refused.because)];
      if (card.why === null && card.answer !== undefined) return ["failed", `Didn't work. ${card.answer}`];
      return ["failed", joined(card.check ? "Didn't pass" : "Didn't work", card.why ?? card.said)];
  }
}

/** A test's typing step's target, the words typed and then the field (Core's `activityActionOf`): '"3" into Quantity'. */
const TYPED = /^"(.*)" into (.+)$/su;
/** The least room the words typed keep before the field is left out. */
const MIN_TYPED_ROOM = 12;

/**
 * A target within `room` characters. Words typed into a field are what tell
 * two typing cards apart, so a typed target keeps them, cut from the middle
 * if it must, and leaves out the field when both do not fit (the field is in
 * the card's label, and the decision above it says it). Any other target is
 * cut from the middle (`cutMiddle`).
 */
function shortened(text: string, room: number): string {
  if (text.length <= room) return text;
  const typed = TYPED.exec(text);
  if (!typed) return cutMiddle(text, room);
  const into = ` into ${typed[2]!}`;
  const withField = room - 2 - into.length;
  return withField >= MIN_TYPED_ROOM ? `"${cutMiddle(typed[1]!, withField)}"${into}` : `"${cutMiddle(typed[1]!, room - 2)}"`;
}

/**
 * `text` within `room` characters, cut from the middle: its first word when
 * that takes at most half the room, then as many of its last words as fit,
 * then more of its first words if any room is left, joined by " … ". A text
 * of one word, or whose last word alone does not fit, is cut inside, keeping
 * more of its end than of its start.
 */
function cutMiddle(text: string, room: number): string {
  if (text.length <= room) return text;
  const words = text.split(" ").filter(Boolean);
  const first = words[0] ?? "";
  const head: string[] = words.length > 1 && first.length <= room / 2 ? [first] : [];
  const tail: string[] = [];
  const length = (start: readonly string[], end: readonly string[]): number => start.join(" ").length + (start.length ? GAP.length : 1) + end.join(" ").length;
  for (let index = words.length - 1; index >= head.length; index -= 1) {
    if (length(head, [words[index]!, ...tail]) > room) break;
    tail.unshift(words[index]!);
  }
  if (!tail.length) return cutInside(text, room);
  for (let index = head.length; index < words.length - tail.length; index += 1) {
    if (length([...head, words[index]!], tail) > room) break;
    head.push(words[index]!);
  }
  return head.length ? `${head.join(" ")}${GAP}${tail.join(" ")}` : `…${tail.join(" ")}`;
}

function cutInside(text: string, room: number): string {
  const kept = Math.max(room - 1, 2);
  const end = Math.ceil(kept * 0.6);
  return `${text.slice(0, kept - end)}…${text.slice(-end)}`;
}

function joined(head: string, reason: string | null | undefined): string {
  const said = reason?.trim();
  return said ? `${head}: ${lowerFirst(said)}` : head;
}

/**
 * "The field was covered." reads "the field was covered." after a colon; "URL"
 * or "PIN" stays as it is, and so does a name with a capital inside its first
 * word, such as "FluxIQ" (t194 lead: "FluxIQ didn't send it" read "fluxIQ").
 */
function lowerFirst(sentence: string): string {
  const [first, second] = [sentence.charAt(0), sentence.charAt(1)];
  const word = /^\S+/u.exec(sentence)?.[0] ?? "";
  if (/\p{Lu}/u.test(word.slice(1))) return sentence;
  return second !== "" && second === second.toLowerCase() && second !== second.toUpperCase() ? first.toLowerCase() + sentence.slice(1) : sentence;
}
