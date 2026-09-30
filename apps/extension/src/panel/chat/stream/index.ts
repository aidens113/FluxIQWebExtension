// The chat's message stream as data: Core's activity events as the steps a
// person reads (`activityRows`: internal reads dropped, ids put in words),
// thread turns and those rows on one timeline (`buildChatStream`), folded
// above the turns they led to (`buildChatThread`), and each fold's summary
// line, and which activity belongs to the chat on screen
// (`activityForTarget`). No DOM.
export { activityRows, type ActivityRow, type ActivityRows } from "./activity-rows";
export { isInternalStep } from "./step-filter";
export { stepWords, type StepWords } from "./step-words";
export { buildChatStream, CHAT_ACTIVITY_ROW_LIMIT, type ChatStream, type ChatStreamItem } from "./stream-items";
export { activityForTarget, type TargetActivity } from "./target-activity";
export { buildChatThread, type ChatThread, type ThreadEntry, type WorkFold } from "./thread-entries";
export { createTurnClock, type StampedTurn, type TurnClock } from "./turn-clock";
export { duration, workFailed, workSummary } from "./work-summary";
