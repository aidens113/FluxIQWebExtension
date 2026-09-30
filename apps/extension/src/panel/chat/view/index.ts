// The chat's DOM parts: the message list and its turns, folds and live line,
// and following new content while the person is at the bottom.
export { createLiveLine, type LiveLine } from "./live-line";
export { liveLineModel, type LiveLineModel } from "./live-line-model";
export { createMessageView, type MessageView } from "./message-view";
export { placeChildren } from "./place-children";
export { FOLLOW_SLACK_PX, isAtBottom, type ScrollMetrics } from "./scroll-follow";
export { createScrollFollower, type ScrollFollower, type ScrollHost } from "./scroll-follower";
export { createThreadView, type ThreadView, type TurnControls } from "./thread-view";
export { createWorkDisclosure, type WorkDisclosure } from "./work-disclosure";
