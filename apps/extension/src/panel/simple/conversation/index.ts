// The conversation card: FluxIQ Core's thread, shown and fed through the
// background's relays. `card.ts` renders; `controller.ts` holds what is on screen.
export { askPresentation, type AskChoice, type AskPresentation } from "./ask-copy";
export { CONVERSATION_REFRESH_MS, createConversationCard, type ConversationCard } from "./card";
export {
  createConversationController,
  type ConversationController,
  type ConversationFallbackReason,
  type ConversationMode,
  type ConversationState
} from "./controller";
export { parseConversation, parseThreadPage, type CoreAsk, type CoreConversation, type CoreThreadPage, type CoreTurn } from "./core-thread";
export { readThreadTail, TURN_WINDOW, type ThreadTail, type ThreadTailTarget } from "./thread-tail";
