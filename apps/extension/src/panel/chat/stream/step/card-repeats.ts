// Cards that only repeat what the chat already shows, as one card each that
// counts them.
//
// The build's model can ask for the same thing again and again after Core
// declined it, or try the same call and see it fail the same way, and each
// was a card of its own:
//
// - three "Edit the Flow · run the step again / Not done: that step was
//   already tried exactly this way ..." cards in a row read as three pieces of
//   work (U-8 of the run-muw60j7c-bb7c9a62 UI review);
// - a refused rerun and the rerun of a list read that Core did not send
//   alternated, "Edit the Flow / Not done" then "Read list / Didn't work", one
//   pair per attempt (R2-U-7 of the run-muwansvz-a2b4a987 UI review, steps
//   0033-0046).
//
// So a card that did nothing -- a decision Core declined in whole, or an
// action that didn't work -- folds into an identical card shown earlier in the
// same stretch of cards: same unit of work, and the same kind, target, test
// mark, outcome and reason, so the same words. A stretch is the cards that
// follow one another with nothing new between them. Words of FluxIQ's (a
// decision with its reason, a repair, a note) end it, and so does a card that
// did anything, even in part, which is never folded. A card that is new to the
// stretch after one of its cards has already repeated starts a new stretch, so
// the order still reads true: A B A B A B is A (3 times) and B (3 times), and
// A B A C A is A (2 times), B, C, A. The card folded into keeps its key and
// its place and says how many times it stands for (`times`; "Not done (3
// times): ...", "Didn't work (3 times): ...", `card-words.ts`). A message
// that was only folded cards is gone; one with words keeps them. No DOM.

import type { ActionCard } from "./action-card";
import type { StepMessage } from "./messages";

/** Messages whose words show above their cards: a card after them is new, whatever came before. */
const SPOKEN: ReadonlySet<StepMessage["kind"]> = new Set<StepMessage["kind"]>(["decision", "repair", "note"]);

/** One card of the current stretch, where it is kept, and what it says. */
type Shown = { message: StepMessage; card: number; words: string };
/** The cards shown since something new, in one unit of work; `repeated` once any of them was folded into. */
type Stretch = { activityId: string; cards: Shown[]; repeated: boolean };

/** `messages` (oldest first), with each card that repeats one of its stretch folded into that card. */
export function foldRepeatedCards(messages: readonly StepMessage[]): StepMessage[] {
  const kept: StepMessage[] = [];
  let stretch: Stretch | undefined;
  for (const message of messages) {
    // Words above a message's cards are new: a card after them repeats nothing before.
    if (SPOKEN.has(message.kind) || message.actions.length === 0) stretch = undefined;
    if (stretch !== undefined && stretch.activityId !== message.activityId) stretch = undefined;
    const copy: StepMessage = { ...message, actions: [] };
    for (const card of message.actions) {
      const words = nothingDone(card) ? sameWords(card) : undefined;
      if (words === undefined) {
        copy.actions.push(card);
        stretch = undefined;
        continue;
      }
      const same = stretch?.cards.find((shown) => shown.words === words);
      if (stretch !== undefined && same !== undefined) {
        const before = same.message.actions[same.card]!;
        same.message.actions[same.card] = { ...before, times: (before.times ?? 1) + (card.times ?? 1) };
        same.message.sequence = Math.max(same.message.sequence, message.sequence);
        stretch.repeated = true;
        continue;
      }
      if (stretch?.repeated) stretch = undefined;
      copy.actions.push(card);
      stretch ??= { activityId: message.activityId, cards: [], repeated: false };
      stretch.cards.push({ message: copy, card: copy.actions.length - 1, words });
    }
    if (copy.actions.length === 0 && message.actions.length > 0) continue;
    kept.push(copy);
  }
  return kept;
}

/** A decision Core declined in whole, or an action that didn't work: nothing came of it. */
function nothingDone(card: ActionCard): boolean {
  if (card.refused !== undefined) return card.refused.all && card.outcome !== "waiting";
  return card.outcome === "failed" && !card.unconfirmed;
}

/** What the card says, but for its count: two cards with the same are the same card shown twice. */
function sameWords(card: ActionCard): string {
  const named = [card.kind, card.target, card.testing === true];
  // A refusal says only that it was not done and why, whatever outcome the card carries (`card-words.ts`).
  if (card.refused !== undefined) return JSON.stringify([...named, "refused", card.refused.because]);
  return JSON.stringify([...named, card.check, card.why, card.why === null ? card.said ?? null : null, card.answer ?? null]);
}
