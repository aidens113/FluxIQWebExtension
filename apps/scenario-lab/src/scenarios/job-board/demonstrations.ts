import type { ScenarioDemonstration, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { remoteEasyApplyWorkflow } from "./breadth/index.js";
import { insertAfterStep } from "../insert-after-step.js";

/** The sort line's own links, which carry every filter and the sort the page was drawn with in their addresses. */
const SORT_LINKS = "span:has(> b) > a";

/** Full-time ticked from the Job type menu, then the menu's "Any job type" put back. */
const JOB_TYPE_DETOUR: ScenarioStep[] = [
  { id: "demo-open-job-type", operation: "click", target: "role:button:Job type" },
  { id: "demo-full-time", operation: "click", target: "role:link:Full-time" },
  { id: "demo-full-time-shown", operation: "waitForState", target: `${SORT_LINKS}[href*="type=fulltime"]`, timeoutMs: 8000 },
  { id: "demo-reopen-job-type", operation: "click", target: "role:button:Job type" },
  { id: "demo-any-job-type", operation: "click", target: "role:link:Any job type" },
  { id: "demo-any-job-type-back", operation: "waitForState", target: `${SORT_LINKS}:not([href*="type="])`, timeoutMs: 8000 },
];

/**
 * Relevance tried after the date sort, then date chosen again. The board refuses every sixth results page it serves
 * (the refusals are counted whether or not they are answered), and with the Job type detour this is that sixth page: a
 * person waits out the countdown and presses "Try again", so the demonstration does.
 */
const SORT_DETOUR: ScenarioStep[] = [
  { id: "demo-sort-relevance", operation: "click", target: "role:link:relevance" },
  { id: "demo-rate-limited", operation: "waitForState", target: "text=Hang on a moment", timeoutMs: 8000 },
  { id: "demo-retry", operation: "click", target: "role:button:Try again" },
  { id: "demo-relevance-shown", operation: "waitForState", target: `${SORT_LINKS}[href*="sort=date"]`, timeoutMs: 8000 },
  { id: "demo-sort-date-again", operation: "click", target: "role:link:date" },
  { id: "demo-date-back", operation: "waitForState", target: `${SORT_LINKS}:not([href*="sort="])`, timeoutMs: 8000 },
];

export const JOB_BOARD_DEMONSTRATIONS: readonly ScenarioDemonstration[] = [
  {
    id: "job-board-remote-easy-apply-demo",
    scenarioId: "job-board",
    taskId: "job-board-remote-easy-apply",
    description: "I search all jobs, choose Remote only, try the Job type menu with Full-time and switch it back to any type, sort by date, try relevance for a moment and go back to date, show fifty jobs to a page, and then read the jobs that offer Easily apply and show a salary.",
    steps: insertAfterStep(insertAfterStep(remoteEasyApplyWorkflow.recordingScript, "easy-remote-only", JOB_TYPE_DETOUR), "easy-sort-by-date", SORT_DETOUR),
    detours: [
      {
        stepIds: ["demo-open-job-type", "demo-full-time", "demo-full-time-shown", "demo-reopen-job-type", "demo-any-job-type", "demo-any-job-type-back"],
        why: "An extra Job type filter (Full-time) the task never asks for, applied and cleared again before sorting.",
        acts: [{ operation: "click", target: "Job type" }, { operation: "click", target: "Full-time" }],
      },
      {
        stepIds: ["demo-sort-relevance", "demo-rate-limited", "demo-retry", "demo-relevance-shown", "demo-sort-date-again", "demo-date-back"],
        why: "The default relevance order tried after sorting by date, then date chosen again so the list is newest first when read.",
        acts: [{ operation: "click", target: "relevance" }],
      },
    ],
  },
];
