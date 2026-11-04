// The person's answer, scored on the attempt itself before any fixture reset, apart
// from whether a Flow became deterministic (Answer First, Lab lane).
export { attemptEndingOfBuild } from "./ending-of-build.js";
export { judgeAttemptAnswer, type AttemptAnswerJudgement } from "./judge-answer.js";
export { judgeShownAnswer, type ShownAnswerJudgement } from "./judge-shown.js";
export { liveAnswerStage } from "./live-stage.js";
export type { AttemptEndingFact, ChatAnswerPort, CreatedFlowAnswerStage, ShownAnswer, ShownAnswerTurn } from "./ports.js";
export { scoreAnswer } from "./score-answer.js";
