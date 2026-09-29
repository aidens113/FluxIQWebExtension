// How a question FluxIQ asked in the thread is shown, and what each answer
// sends (UI audit, section 4, "3. Conversation card": "A turn that carries a
// Core ask shows the ask's options as buttons, which send answer-ask with
// { askId, kind, value }").
//
// The answer kinds are Core's (`automationStudioConversationAnswerFits`): a
// permission or a confirmation is granted or refused, a choice names an
// option by id, an open question takes words. A question this panel cannot
// answer -- a kind it does not know, or a choice with no options -- says so and
// points to FluxIQ, rather than offering buttons Core would refuse.

import type { CoreAsk } from "./core-thread";

/** One answer button: its words, and the `kind` and `value` it sends. */
export type AskChoice = { label: string; kind: string; value?: string };

/** What a question shows under its turn. */
export type AskPresentation =
  | { state: "choices"; choices: AskChoice[] }
  /** An open question: a text box and an Answer button, sending `kind: "text"`. */
  | { state: "words" }
  /** It can be answered only in FluxIQ. */
  | { state: "elsewhere"; sentence: string }
  /** Answered, or no longer waiting. */
  | { state: "settled"; sentence: string };

const ELSEWHERE = "Answer this in FluxIQ.";

/** How `ask` shows. */
export function askPresentation(ask: CoreAsk): AskPresentation {
  if (ask.status === "expired") return { state: "settled", sentence: "FluxIQ stopped waiting for an answer." };
  if (ask.status !== "pending") return { state: "settled", sentence: answeredSentence(ask) };
  switch (ask.kind) {
    case "permission":
      return { state: "choices", choices: [{ label: "Allow", kind: "grant" }, { label: "Don't allow", kind: "deny" }] };
    case "confirm":
      return { state: "choices", choices: [{ label: "Yes", kind: "grant" }, { label: "No", kind: "deny" }] };
    case "choice":
      return ask.options && ask.options.length > 0
        ? { state: "choices", choices: ask.options.map((option) => ({ label: option.label, kind: "choice", value: option.id })) }
        : { state: "elsewhere", sentence: ELSEWHERE };
    case "open":
      return { state: "words" };
    default:
      return { state: "elsewhere", sentence: ELSEWHERE };
  }
}

function answeredSentence(ask: CoreAsk): string {
  const answer = ask.answer;
  if (answer === null) return "Answered.";
  switch (answer.kind) {
    case "grant":
      return ask.kind === "permission" ? "You allowed this." : "You said yes.";
    case "deny":
      return ask.kind === "permission" ? "You didn't allow this." : "You said no.";
    case "choice": {
      const option = ask.options?.find((candidate) => candidate.id === answer.value);
      return option === undefined ? "You chose an option." : `You chose "${option.label}".`;
    }
    default:
      return "You answered.";
  }
}
