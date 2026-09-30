// FluxIQ Core's conversation, read and fed through the background's relays.
// `controller.ts` holds what is on screen and `thread-requests.ts` which
// thread that is for each target; `composer.ts`, `ask-controls.ts` and
// `read/notice.ts` are the parts the chat window (`panel/chat/`) mounts.
export { askControls, type AskControlsContext } from "./ask-controls";
export { askPresentation, type AskChoice, type AskPresentation } from "./ask-copy";
export { createComposer, type Composer } from "./composer";
export { composerKeyAction, type ComposerKey, type ComposerKeyAction } from "./composer-keys";
export {
  createConversationController,
  type ConversationController,
  type ConversationFallbackReason,
  type ConversationMode,
  type ConversationState
} from "./controller";
export { createReadNotice, READ_RETRY, readFailureNotice, UNREADABLE_CODE, type ConversationClock, type ReadNotice, type ThreadReadStep } from "./read";
export { parseConversation, parseThreadPage, type CoreAsk, type CoreConversation, type CoreThreadPage, type CoreTurn } from "./core-thread";
export { threadListRequest, threadSendRequest, type ShownThread } from "./thread-requests";
export { readThreadTail, TURN_WINDOW, type ThreadTail, type ThreadTailTarget } from "./thread-tail";
