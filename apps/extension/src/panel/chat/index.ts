// The chat: FluxIQ Core's conversation (the latest thread, or one
// automation's) and FluxIQ's live activity in one window that fills the
// panel. The chat itself is `@fluxiq/ui-components`; `chat-panel.ts` mounts it
// over the extension's background (`transport/`), `feed/` and `owner-context.ts`
// are the extension's views of the package's feed and owner context, and
// `settings/` holds the on-page status preference for the panel's settings to
// mount. The names the panel's other views import stay here.
export { createChatPanel, type ChatPanel, type ChatPanelOptions, type OpenFluxIQControl, type OpenFluxIQFactory } from "./chat-panel";
export {
  actionCard,
  activityForTarget,
  buildChatStream,
  cardWords,
  CHAT_STEP_MESSAGE_LIMIT,
  createHoldControl,
  createStopControl,
  createTurnClock,
  emptyStateModel,
  followedRunTarget,
  isAtBottom,
  liveLineModel,
  parseAssistantText,
  renderTextBlocks,
  stepMessages,
  stepText,
  stepWords,
  threadRefreshWanted,
  type ActionCard,
  type ActivityFeed,
  type ActivityFeedReach,
  type ActivityFeedSnapshot,
  type CardWords,
  type ChatStream,
  type ChatStreamItem,
  type ChatTarget,
  type EmptyStateModel,
  type LiveLineModel,
  type RunTargetInput,
  type StepMessage,
  type TextBlock,
  type TextRun
} from "@fluxiq/ui-components";
export { createActivityFeed, listenToRuntime, type ExtensionActivityFeedDeps } from "./feed";
export { createOnPageStatusSetting, onPageStatusModel, type OnPageStatusModel, type OnPageStatusSetting } from "./settings";
export { createChatOwnerContext, type ChatOwner } from "./owner-context";
