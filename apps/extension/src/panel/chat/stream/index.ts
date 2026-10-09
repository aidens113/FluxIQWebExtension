// The chat's message stream as data: Core's activity events as FluxIQ's step
// messages, one per decision, check or repair, with its reason and each
// action it took as a card (`stepMessages`, `actionCard`, `cardWords`;
// internal reads dropped, ids put in words), thread turns and those messages on one timeline
// (`buildChatStream`), which activity belongs to the chat on screen
// (`activityForTarget`), and which thread holds the question work is waiting
// on (`askThread`). No DOM.
export { askThread, type QuestionTarget } from "./ask-thread";
export {
  actionCard,
  cardWords,
  doneAgainWords,
  stepMessages,
  stepWords,
  type ActionCard,
  type CardWords,
  type StepMessage,
  type StepMessageKind,
  type StepWords
} from "./step";
export { buildChatStream, CHAT_STEP_MESSAGE_LIMIT, type ChatStream, type ChatStreamItem } from "./stream-items";
export { followedRunTarget, threadKey, type RunTargetInput } from "./run-target";
export { activityForTarget, type TargetActivity } from "./target-activity";
export { createTurnClock, type StampedTurn, type TurnClock } from "./turn-clock";
