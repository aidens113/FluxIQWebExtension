// A question in the words a person reads under its turn. The turn's own words
// are Core's and always show, so a question whose whole sentence they already
// are has no title here: it is asked once. What this adds is the act as a
// question, what an answer would change, and the answers, named by what they do.
//
// The button names are pressed by the Lab (`packages/test-runner/src/run-scenario/
// chat-build/chat-entry.ts`, `answerLabel`, an exact match on the words): Allow and
// Don't allow, Yes and No, and each option's own label, Stop among them. So the
// check's Stop keeps Core's name and says what it does on hover, rather than
// reading "Stop the task".
//
// Only a `panel-command.` confirmation naming a gated class carries `reauthorize`
// (`takes-pin.ts`), and never while a task is working: nothing asks for a PIN in
// the middle of a task. Its Confirm goes away then, and the question says when it
// can be answered; a Cancel commits nothing and stays.
//
// Firefox's popup closes on a click in the page, taking Continue with it, so a
// person-only check says so before they click. The question is Core's, so it is
// still there when they come back.

import { AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES } from "fluxiq/automation/action-permissions";
import type { ChatAskAction, ChatAskPresentation } from "@fluxiq/ui-components";
import { askRecordOf, type AskRecord } from "./ask-record";
import { askTakesPin } from "./takes-pin";

/** Core's marker on a person-only check, so it is never recognised by its words. */
const PERSON_CHECK_CONTROL_KIND = "person_check";
const PERSON_DONE = "person_done";
const PERSON_STOP = "person_stop";

/** The most a turn holds (Core's `AUTOMATION_STUDIO_CONVERSATION_TEXT_MAX`). */
const TEXT_MAX = 8_000;
const LEAD = "This would:";
const STOP_SAYS = "Stop the task";
const POPUP_CLOSES = "This window closes when you click the page. Press the FluxIQ button to come back and press Continue.";
const NO_PIN_HERE = "This panel can't take your PIN.";
const AFTER_THE_TASK = "You can confirm this once the task has ended.";

/** What the words depend on besides the record. */
export type AskPresentContext = {
  /** The surface the panel is mounted on (`document.documentElement.dataset.surface`). */
  surface(): string | undefined;
  /** True while a task is working or waiting on the person. */
  working(): boolean;
};

/** `value` as the chat should show it; null: the chat's own words for a question this cannot read. */
export function presentAsk(value: unknown, context: AskPresentContext): ChatAskPresentation | null {
  const ask = askRecordOf(value);
  if (ask === null) return null;
  switch (ask.kind) {
    case "permission":
      return permission(ask);
    case "confirm":
      return askTakesPin(ask) ? pinConfirmation(ask, context) : confirmation(ask);
    case "choice":
      if (ask.options.length === 0) return null;
      return ask.control.kind === PERSON_CHECK_CONTROL_KIND ? personCheck(ask, context) : choice(ask);
    case "open":
      return { ...plain(ask), actions: [], takesText: true, textMax: TEXT_MAX };
    default:
      return null;
  }
}

function permission(ask: AskRecord): ChatAskPresentation {
  return {
    ...plain(ask),
    title: ask.control.name === null ? "Allow FluxIQ to do this?" : `Allow FluxIQ to ${ask.verb ?? "use"} "${ask.control.name}"?`,
    actions: [answer("grant", "Allow", "primary"), answer("deny", "Don't allow", "secondary")],
    takesText: false
  };
}

function confirmation(ask: AskRecord): ChatAskPresentation {
  return { ...plain(ask), actions: [answer("grant", "Yes", ask.commits.length > 0 ? "danger" : "primary"), answer("deny", "No", "secondary")], takesText: false };
}

function pinConfirmation(ask: AskRecord, context: AskPresentContext): ChatAskPresentation {
  const cancel = answer("deny", "Cancel", "secondary");
  if (context.working()) return { ...plain(ask), note: AFTER_THE_TASK, actions: [cancel], takesText: false };
  const confirm: ChatAskAction = {
    ...answer("grant", "Confirm", "danger"),
    reauthorize: { title: "Enter your PIN", description: `Confirming will ${joined(phrasesOf(ask))}. It can't be undone.`, actionLabel: "Confirm" }
  };
  return { ...plain(ask), note: NO_PIN_HERE, actions: [confirm, cancel], takesText: false };
}

function personCheck(ask: AskRecord, context: AskPresentContext): ChatAskPresentation {
  const onPopup = context.surface() === "popup";
  return {
    ...plain(ask),
    description: onPopup ? POPUP_CLOSES : "",
    actions: ask.options.map((option) => {
      if (option.id === PERSON_DONE) return { ...optionAction(option), tone: "primary" as const };
      if (option.id === PERSON_STOP) return { ...optionAction(option), description: STOP_SAYS };
      return optionAction(option);
    }),
    takesText: false
  };
}

function choice(ask: AskRecord): ChatAskPresentation {
  return { ...plain(ask), actions: ask.options.map(optionAction), takesText: false };
}

function optionAction(option: AskRecord["options"][number]): ChatAskAction {
  return { id: option.id, label: option.label, tone: "secondary", kind: "choice", value: option.id, ...(option.description === undefined ? {} : { description: option.description }) };
}

function answer(kind: "grant" | "deny", label: string, tone: ChatAskAction["tone"]): ChatAskAction {
  return { id: kind, label, tone, kind };
}

/** What every question shares: no title of its own, and what an answer would change. */
function plain(ask: AskRecord): Omit<ChatAskPresentation, "actions" | "takesText"> {
  const consequences = phrasesOf(ask);
  return { title: "", description: consequences.length > 0 ? LEAD : "", consequences };
}

function phrasesOf(ask: AskRecord): string[] {
  const phrases = AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES as Readonly<Record<string, string>>;
  return ask.commits.flatMap((consequence) => (phrases[consequence] === undefined ? [] : [phrases[consequence]]));
}

function joined(phrases: readonly string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? "do this";
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}
