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
//            narrow panel shows. Every cut falls where a word ends, never
//            inside one ("Hybr…"), and a list Core names as "name, price,
//            rating and 3 more" names fewer of its items and counts the rest
//            ("name, price and 4 more") rather than leaving a gap inside it
//            (U-13 of the run-muw60j7c-bb7c9a62 UI review). A path with no
//            spaces is cut where one of its parts ends ("…napkins-250"); one
//            word with nowhere to cut is left whole for the view
//   outcome  "Working on it" and "Waiting for you" only while it is the
//            action of the moment (the newest of work still under way);
//            "Done", or "Done: 13 rows from 5 pages" when Core said what a
//            finished action came to (its `result`), "Passed", "Didn't work:
//            it wasn't on the page",
//            "Didn't pass: no price was shown"; "Not confirmed: ..." for a
//            result check Core could not confirm, which is no failure: an
//            unverified run that met its task read "Didn't pass" in red
//            (t174-w85 D1); for a step of a test of the Flow that it did not
//            simply do again, Core's words for what it did instead: "Checked,
//            not pressed", "Already done on the site", "Skipped: not there,
//            optional" (t193 1002-M, C10: all of them read "Done", and the
//            skipped one "Didn't work"), with what it came to after a dash
//            when Core said; for a wait on the person
//            that Core settled, its sentence: "Done. You pressed Continue.",
//            "Didn't work: you pressed Stop"; for a decision Core declined
//            before doing it, "Not done: that step is already in the Flow",
//            or "Only partly done: ..." for an edit some of which landed --
//            never "Didn't work", since nothing was tried and failed (t193
//            1003, C13), and never "Done" or "Working on it", whatever outcome
//            the card carries: a refusal is no work (U-8 of the
//            run-muw60j7c-bb7c9a62 UI review). Identical refusals in a row are
//            one card that says how many ("Not done (3 times): ...",
//            `messages.ts`); nothing for an action that never said it ended
//            once the work moved on
//   label    all three in one line, for the card's accessible name, with the
//            whole target
//
// `state` drives the card's mark: `settled` is an action that never said how
// it went, `unconfirmed` a result check that neither passed nor failed, and
// `refused` a decision Core declined, neither of which takes a failure's
// colour. No DOM.

import { ACTIVITY_ACTION_NAMES } from "fluxiq/ui";
import { longestWordCut } from "../../../../shared/activity/index";
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
  // A decision Core declined is no work, done or under way, whatever its outcome says.
  if (card.refused !== undefined && card.outcome !== "waiting") {
    const { all, because } = card.refused;
    return all ? ["refused", joined(counted("Not done", card.times), because)] : ["done", joined(counted("Only partly done", card.times), because)];
  }
  switch (card.outcome) {
    case "working":
      return current ? ["working", "Working on it"] : ["settled", null];
    case "waiting":
      // Only Core's resolved row ends a wait (`resolution`, including
      // `cancelled` when the work stops first), never the work moving on.
      return ["waiting", "Waiting for you"];
    case "done":
      if (card.answer !== undefined) return ["done", `Done. ${card.answer}`];
      if (card.tested !== undefined) return ["done", resultOf(card) === undefined ? card.tested : `${card.tested} — ${resultOf(card)}`];
      return ["done", card.check ? joined("Passed", card.said) : joined("Done", resultOf(card))];
    case "failed":
      if (card.unconfirmed) return ["unconfirmed", joined("Not confirmed", card.said)];
      if (card.why === null && card.answer !== undefined) return ["failed", `Didn't work. ${card.answer}`];
      return ["failed", joined(card.check ? "Didn't pass" : "Didn't work", card.why ?? card.said)];
  }
}

/** What a finished action came to, as Core said it; undefined when it said nothing. */
function resultOf(card: ActionCard): string | undefined {
  return card.result?.trim() || undefined;
}

/** "Not done (3 times)" for a card standing for several identical refusals. */
function counted(head: string, times: number | undefined): string {
  return times !== undefined && times > 1 ? `${head} (${times} times)` : head;
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
  const list = shorterList(text, room);
  if (list !== undefined) return list;
  const typed = TYPED.exec(text);
  if (!typed) return cutMiddle(text, room);
  const into = ` into ${typed[2]!}`;
  const withField = room - 2 - into.length;
  return withField >= MIN_TYPED_ROOM ? `"${cutMiddle(typed[1]!, withField)}"${into}` : `"${cutMiddle(typed[1]!, room - 2)}"`;
}

/** Core's name for a list of more items than it names: "name, price, rating and 3 more". */
const LIST = /^(.+) and (\d+) more$/u;

/**
 * A list Core named within `room` characters, naming fewer of its items and
 * counting the rest: "name, price and 4 more". Undefined for a target that is
 * no such list, or whose first item alone does not fit.
 */
function shorterList(text: string, room: number): string | undefined {
  const list = LIST.exec(text);
  if (!list) return undefined;
  const named = list[1]!.split(", ");
  const more = Number(list[2]);
  for (let kept = named.length - 1; kept >= 1; kept -= 1) {
    const said = `${named.slice(0, kept).join(", ")} and ${more + named.length - kept} more`;
    if (said.length <= room) return said;
  }
  return undefined;
}

/** Where a word with no spaces may be cut: before each of its separators ("/", "-", "_", "."). */
const PART = /(?=[/\-_.])/u;
/** A separator a part kept after the ellipsis opens with. */
const LEADING_SEPARATOR = /^[/\-_.]/u;

/**
 * `text` within `room` characters, cut from the middle where words end: its
 * first word when that takes at most half the room, then as many of its last
 * words as fit, then more of its first words if any room is left, joined by
 * " … ". When its last word alone does not fit, its first words that do, then
 * an ellipsis; when not even its first word does, one word is cut the same
 * way where one of its parts ends, and a word with no parts is left whole.
 */
function cutMiddle(text: string, room: number): string {
  if (text.length <= room) return text;
  const words = text.split(" ").filter(Boolean);
  const middle = keepEnds(words, " ", room);
  if (middle !== undefined) return middle;
  const start = longestWordCut(text, (candidate) => candidate.length <= room);
  if (start !== null) return start;
  const parts = text.split(PART);
  return (parts.length > 1 ? keepEnds(parts, "", room) : undefined) ?? text;
}

/**
 * `pieces` joined by `joiner` within `room` characters: the first piece when
 * it takes at most half the room, as many of the last as fit, then more of the
 * first; undefined when the last piece alone does not fit.
 */
function keepEnds(pieces: readonly string[], joiner: string, room: number): string | undefined {
  // What stands for the words, or the parts of a word, a cut leaves out.
  const gap = joiner === "" ? "…" : " … ";
  const first = pieces[0] ?? "";
  const head: string[] = pieces.length > 1 && first.length <= room / 2 ? [first] : [];
  const tail: string[] = [];
  const length = (start: readonly string[], end: readonly string[]): number => start.join(joiner).length + (start.length ? gap.length : 1) + end.join(joiner).length;
  for (let index = pieces.length - 1; index >= head.length; index -= 1) {
    if (length(head, [pieces[index]!, ...tail]) > room) break;
    tail.unshift(pieces[index]!);
  }
  if (!tail.length) return undefined;
  for (let index = head.length; index < pieces.length - tail.length; index += 1) {
    if (length([...head, pieces[index]!], tail) > room) break;
    head.push(pieces[index]!);
  }
  // A part kept after the ellipsis does not open with the separator it was cut at ("…napkins-250").
  const end = joiner === "" ? tail.join("").replace(LEADING_SEPARATOR, "") : tail.join(joiner);
  return head.length ? `${head.join(joiner)}${gap}${end}` : `…${end}`;
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
