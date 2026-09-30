// FluxIQ Core's conversation, read and fed through the background's relays.
// `controller.ts` holds what is on screen; `composer.ts`, `turn.ts` and
// `ask-controls.ts` are the parts the chat window (`panel/chat/`) mounts.
export { askControls, type AskControlsContext } from "./ask-controls";
export { askPresentation, type AskChoice, type AskPresentation } from "./ask-copy";
export { createComposer, type Composer } from "./composer";
export {
  createConversationController,
  type ConversationController,
  type ConversationFallbackReason,
  type ConversationMode,
  type ConversationState
} from "./controller";
export { parseConversation, parseThreadPage, type CoreAsk, type CoreConversation, type CoreThreadPage, type CoreTurn } from "./core-thread";
export { readThreadTail, TURN_WINDOW, type ThreadTail, type ThreadTailTarget } from "./thread-tail";
export { turnElement } from "./turn";
