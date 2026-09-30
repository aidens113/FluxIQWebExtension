// What an empty chat says, and the example prompts it offers. The examples
// only fill the composer, so the person reads and edits one before anything
// is sent; they show only when a message could be sent now. An automation's
// empty chat asks about that automation. No DOM.

import type { ConversationMode } from "../conversation";
import type { ChatTarget } from "../target";

/** The empty state's words; null when the chat is not empty. */
export type EmptyStateModel = { title: string; line: string; examples: readonly string[] };

const LATEST_EXAMPLES: readonly string[] = [
  "Collect the name and price of every product on this page",
  "Check this page every morning and tell me what's new",
  "Fill in this form for me, and stop before sending it"
];

const AUTOMATION_EXAMPLES: readonly string[] = [
  "Run this automation now",
  "Change what this automation collects",
  "Why did the last run stop?"
];

/** The empty state for a chat in `mode` showing `target`. */
export function emptyStateModel(mode: ConversationMode, target: ChatTarget): EmptyStateModel | null {
  const automation = target.kind === "automation" ? target.name.trim() || "this automation" : undefined;
  const title = automation === undefined ? "What can FluxIQ do for you?" : `Ask about ${automation}`;
  switch (mode) {
    case "empty":
      return automation === undefined
        ? { title, line: "Describe what you want done on the page, in your own words. FluxIQ builds it and shows its work here.", examples: LATEST_EXAMPLES }
        : { title, line: "Ask for a change, a run, or why something happened. FluxIQ answers here.", examples: AUTOMATION_EXAMPLES };
    case "offline":
      return { title, line: "Connect to FluxIQ to start a conversation.", examples: [] };
    case "loading":
      return { title: "", line: "Loading the conversation...", examples: [] };
    default:
      return null;
  }
}
