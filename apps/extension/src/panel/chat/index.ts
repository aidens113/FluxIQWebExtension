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
  actionCard,
  activityForTarget,
  buildChatStream,
  cardWords,
  CHAT_STEP_MESSAGE_LIMIT,
  createTurnClock,
  stepMessages,
  stepWords,
  type ActionCard,
  type CardWords,
  type ChatStream,
  type ChatStreamItem,
  type StepMessage
} from "./stream";
export type { ChatTarget } from "./target";
export { createChatOwnerContext, type ChatOwner } from "./owner-context";
export { emptyStateModel, isAtBottom, liveLineModel, stepText, type EmptyStateModel, type LiveLineModel } from "./view";
