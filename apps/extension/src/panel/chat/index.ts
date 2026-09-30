// The chat: FluxIQ Core's conversation (the latest thread, or one
// automation's) and FluxIQ's live activity in one window that fills the
// panel. `chat-panel.ts` mounts it; `conversation/`, `feed/`, `stream/` and
// `format/` hold what it knows, each without DOM where it can be, `view/`
// builds and updates the parts, and `settings/` holds the on-page status
// preference for the panel's settings to mount.
export { createChatPanel, type ChatPanel, type ChatPanelOptions, type OpenFluxIQControl, type OpenFluxIQFactory } from "./chat-panel";
export {
  createActivityFeed,
  threadRefreshWanted,
  type ActivityFeed,
  type ActivityFeedReach,
  type ActivityFeedSnapshot
} from "./feed";
export { parseAssistantText, renderTextBlocks, type TextBlock, type TextRun } from "./format";
export { createOnPageStatusSetting, onPageStatusModel, type OnPageStatusModel, type OnPageStatusSetting } from "./settings";
export {
  activityForTarget,
  activityRows,
  buildChatStream,
  buildChatThread,
  CHAT_ACTIVITY_ROW_LIMIT,
  createTurnClock,
  isInternalStep,
  stepWords,
  workSummary,
  type ActivityRow,
  type ChatStream,
  type ChatStreamItem,
  type ChatThread,
  type ThreadEntry,
  type WorkFold
} from "./stream";
export type { ChatTarget } from "./target";
export { emptyStateModel, isAtBottom, liveLineModel, stepText, type EmptyStateModel, type LiveLineModel } from "./view";
