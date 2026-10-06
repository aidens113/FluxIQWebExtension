// Identical refusals in a row, as one card that counts them.
//
// The build's model can ask for the same thing again and again after Core
// declined it, and each refusal was a card of its own: three "Edit the Flow ·
// run the step again / Not done: that step was already tried exactly this way
// ..." cards in a row read as three pieces of work (U-8 of the
// run-muw60j7c-bb7c9a62 UI review). A refusal shown right after the same
// refusal -- same unit of work, kind, target, test mark and reason, and no
// words of FluxIQ's between them -- is folded into the card before it, which
// keeps its key and its place and says how many times it stands for
// (`times`; "Not done (3 times): ...", `card-words.ts`). A message that was
// only folded cards is gone; one with words keeps them. A card that did
// anything, even in part, is never folded. No DOM.

import type { ActionCard } from "./action-card";
import type { StepMessage } from "./messages";

/** Messages whose words show above their cards, so a card after them is not "in a row" with one before. */
const SPOKEN: ReadonlySet<StepMessage["kind"]> = new Set<StepMessage["kind"]>(["decision", "repair", "note"]);

/** `messages` (oldest first), with each run of identical refusals folded into its first card. */
export function foldRepeatedRefusals(messages: readonly StepMessage[]): StepMessage[] {
  const kept: StepMessage[] = [];
  let previous: { message: StepMessage; card: number } | undefined;
  for (const message of messages) {
    // Words above a message's cards stand between them and any card before.
    if (SPOKEN.has(message.kind) || message.actions.length === 0) previous = undefined;
    const copy: StepMessage = { ...message, actions: [] };
    for (const card of message.actions) {
      const before = previous?.message.activityId === message.activityId ? previous.message.actions[previous.card] : undefined;
      if (previous !== undefined && before !== undefined && sameRefusal(before, card)) {
        previous.message.actions[previous.card] = { ...before, times: (before.times ?? 1) + (card.times ?? 1) };
        previous.message.sequence = Math.max(previous.message.sequence, message.sequence);
        continue;
      }
      copy.actions.push(card);
      previous = { message: copy, card: copy.actions.length - 1 };
    }
    if (copy.actions.length === 0 && message.actions.length > 0) continue;
    kept.push(copy);
  }
  return kept;
}

/** Both cards are the one decision Core declined in whole, for the same reason. */
function sameRefusal(a: ActionCard, b: ActionCard): boolean {
  return a.refused !== undefined && b.refused !== undefined
    && a.refused.all && b.refused.all
    && a.refused.because === b.refused.because
    && a.kind === b.kind
    && a.target === b.target
    && a.testing === b.testing;
}
