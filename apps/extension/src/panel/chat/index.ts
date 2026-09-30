// The automation chat: FluxIQ Core's conversation and FluxIQ's live activity
// in one window, with a one-line header and a composer. `chat-panel.ts`
// mounts it; `feed/`, `header/`, `stream/` and `format/` hold what it knows,
// each without DOM where it can be, and `view/` builds and updates the parts.
export { createChatPanel, type ChatPanel, type OpenFluxIQControl, type OpenFluxIQFactory } from "./chat-panel";
export {
  createActivityFeed,
  threadRefreshWanted,
  type ActivityFeed,
  type ActivityFeedReach,
  type ActivityFeedSnapshot
} from "./feed";
export { parseAssistantText, renderTextBlocks, type TextBlock, type TextRun } from "./format";
export { chatHeaderModel, stepText, type ChatHeaderModel } from "./header";
export {
  buildChatStream,
  buildChatThread,
  CHAT_ACTIVITY_ROW_LIMIT,
  createTurnClock,
  workSummary,
  type ActivityRow,
  type ChatStreamItem,
  type ChatThread,
  type ThreadEntry,
  type WorkGroup
} from "./stream";
export { isAtBottom, liveLineModel, type LiveLineModel } from "./view";
