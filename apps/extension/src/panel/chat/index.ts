// The automation chat: FluxIQ Core's conversation and FluxIQ's live activity
// in one window, with a status header and a composer. `chat-panel.ts` mounts
// it; `feed/`, `header/` and `stream/` hold what it knows, each without DOM
// where it can be.
export { createChatPanel, type ChatPanel, type OpenFluxIQFactory } from "./chat-panel";
export {
  createActivityFeed,
  threadRefreshWanted,
  type ActivityFeed,
  type ActivityFeedReach,
  type ActivityFeedSnapshot
} from "./feed";
export { chatHeaderModel, stepText, type ChatHeaderModel } from "./header";
export { buildChatStream, CHAT_ACTIVITY_ROW_LIMIT, createTurnClock, type ActivityRow, type ChatStreamItem } from "./stream";
