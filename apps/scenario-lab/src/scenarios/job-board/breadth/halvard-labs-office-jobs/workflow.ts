import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { halvardLabsOfficeJobsExpected } from "./expected.js";

/** Save the matching hybrid role, check the on-site search, then read only this task's additions from My jobs. */
export const halvardLabsOfficeJobsWorkflow: ScenarioWorkflow = {
  id: "halvard-labs-office-jobs",
  recordingDescription: "Demonstrates saving matching workplace-filtered roles while preserving existing saves.",
  description: "Save any Halvard Labs job that is hybrid or on-site; keep existing saves and read the newly saved matching jobs.",
  recordingScript: [
    { id: "labs-accept-cookies", operation: "click", target: "role:button:Accept all" },
    { id: "labs-type-search", operation: "type", target: "input[name=\"q\"]", value: "Halvard Labs" },
    { id: "labs-find-jobs", operation: "click", target: "role:button:Find jobs" },
    { id: "labs-offer-shown", operation: "waitForState", target: "text=No thanks", timeoutMs: 9000 },
    { id: "labs-decline-offer", operation: "click", target: "text=No thanks" },
    { id: "labs-open-workplace-filter", operation: "click", target: "role:button:Remote" },
    { id: "labs-hybrid", operation: "click", target: "role:link:Hybrid" },
    { id: "labs-hybrid-shown", operation: "waitForState", target: 'article[data-jk="864532f1fa5dbc8f"]', timeoutMs: 5000 },
    { id: "labs-chat-opened", operation: "waitForState", target: "rf-assistant .fa-min", timeoutMs: 9000 },
    { id: "labs-minimise-chat", operation: "click", target: "rf-assistant .fa-min" },
    { id: "labs-save-first-try", operation: "click", target: 'article[data-jk="864532f1fa5dbc8f"] h2 + span' },
    { id: "labs-save-refused", operation: "waitForState", target: "text=Couldn't save this job. Try again.", timeoutMs: 3000 },
    { id: "labs-save-hybrid", operation: "click", target: 'article[data-jk="864532f1fa5dbc8f"] h2 + span' },
    { id: "labs-hybrid-saved", operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
    { id: "labs-reopen-workplace-filter", operation: "click", target: "role:button:Remote" },
    { id: "labs-on-site", operation: "click", target: "role:link:On-site" },
    { id: "labs-no-on-site-jobs", operation: "waitForState", target: "article[data-jk=\"13707d7b1e529572\"]", timeoutMs: 5000 },
    { id: "labs-open-my-jobs", operation: "click", target: 'header a[href="/scenarios/job-board/myjobs"]' },
    { id: "labs-saved-list", operation: "waitForState", target: "testid:saved-list", timeoutMs: 5000 },
    {
      id: "extract-halvard-labs-office-jobs",
      operation: "extract",
      target: 'main ol li[data-jk="864532f1fa5dbc8f"]',
      fields: { title: "a", company: ":scope > span:nth-of-type(1)", location: ":scope > span:nth-of-type(2)" },
      minItems: 1,
    },
    { id: "labs-checked", operation: "checkpoint" },
  ],
  expected: halvardLabsOfficeJobsExpected,
};
