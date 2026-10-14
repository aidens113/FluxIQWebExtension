// How long the chat stage waits, from Send, for a build's result
// (`./build-from-chat.ts`), by the authoring mode of the Core under test.
//
// A candidate (and legacy) build is waited the web panel's wait for the same
// request -- 60 s before it, the build's own 600 s, 15 s after
// (`../build-proposal.ts`, `GENERATION_DEADLINE_MS`) -- plus 120 s for the
// chat's steps around it, exactly as before t592. A project build runs a
// supervisor and several builders, trials and resets, and Core bounds it whole
// (`AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS`, thirty minutes). Its
// deadline is that bound in place of the 600 s, with the same steps around it,
// so the Lab waits what Core allows and keeps no copy of Core's number. A8
// launch 7 waited the candidate deadline and lost three of four project builds
// to `lab.chat_build_unfinished` while they were still working (social
// `run-mv8cam5t-436efa46`).

import { AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS, type AutomationStudioAuthoringMode } from "fluxiq/automation-studio";

const CANDIDATE_DEADLINE_MS = 60_000 + 600_000 + 15_000 + 120_000;
const PROJECT_DEADLINE_MS = 60_000 + AUTOMATION_STUDIO_PROJECT_BUILD_MAX_DURATION_MS + 15_000 + 120_000;

/** From Send to the build's result: the build's own bound, by authoring mode, plus the steps around it (header). */
export function createdFlowChatBuildDeadlineMs(authoringMode: AutomationStudioAuthoringMode): number {
  return authoringMode === "project" ? PROJECT_DEADLINE_MS : CANDIDATE_DEADLINE_MS;
}
