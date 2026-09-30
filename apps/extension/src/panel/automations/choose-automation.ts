// What choosing an automation in the automations tab does: the chat opens
// that automation's thread and comes to the front. Kept apart from the DOM so
// the hand-off is tested with plain fakes.

import type { ChatTarget } from "../chat";

/** Where a chosen automation goes: the chat's `open`, and the shell's switch to the chat tab. */
export type ChooseAutomationDeps = { open(target: ChatTarget): void; showChat(): void };

/** Opens `automation` in the chat and shows the chat tab. Answers the target it opened. */
export function chooseAutomation(automation: { readonly flowId: string; readonly name: string }, deps: ChooseAutomationDeps): ChatTarget {
  const target: ChatTarget = { kind: "automation", flowId: automation.flowId, name: automation.name };
  deps.open(target);
  deps.showChat();
  return target;
}
