import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { halvardLabsOfficeJobsExpected } from "./expected.js";

/**
 * A person's recording: search for Halvard Labs, try Hybrid, then On-site,
 * find no jobs either time, and read the results list -- which is not on the
 * page, so the table is empty. The list a search answers with is its
 * container's first child; "Jobs you might like" comes after a notice, so a
 * results-list read never takes a recommendation.
 */
export const halvardLabsOfficeJobsWorkflow: ScenarioWorkflow = {
  id: "halvard-labs-office-jobs",
  recordingDescription: "Demonstrates checking an employer's roles against a workplace filter and finding none.",
  description: "Save any Halvard Labs job that is hybrid or on-site; there is none, so save nothing and return an empty table.",
  recordingScript: [
    { id: "labs-accept-cookies", operation: "click", target: "role:button:Accept all" },
    { id: "labs-type-search", operation: "type", target: "input[name=\"q\"]", value: "Halvard Labs" },
    { id: "labs-find-jobs", operation: "click", target: "role:button:Find jobs" },
    { id: "labs-offer-shown", operation: "waitForState", target: "text=No thanks", timeoutMs: 9000 },
    { id: "labs-decline-offer", operation: "click", target: "text=No thanks" },
    { id: "labs-open-workplace-filter", operation: "click", target: "role:button:Remote" },
    { id: "labs-hybrid", operation: "click", target: "role:link:Hybrid" },
    { id: "labs-no-hybrid-jobs", operation: "waitForState", target: "text=No jobs found", timeoutMs: 5000 },
    { id: "labs-reopen-workplace-filter", operation: "click", target: "role:button:Remote" },
    { id: "labs-on-site", operation: "click", target: "role:link:On-site" },
    // The on-site answer is the hybrid one's twin; its recommendations are what tell the two pages apart.
    { id: "labs-no-on-site-jobs", operation: "waitForState", target: "article[data-jk=\"13707d7b1e529572\"]", timeoutMs: 5000 },
    {
      id: "extract-halvard-labs-office-jobs",
      operation: "extract",
      target: "main ol:first-child article[data-jk]",
      fields: { title: "h2 a", company: ":scope > div:nth-of-type(2) > span:nth-of-type(1)", location: ":scope > div:nth-of-type(2) > span:nth-of-type(2)" },
      minItems: 0,
    },
    { id: "labs-checked", operation: "checkpoint" },
  ],
  expected: halvardLabsOfficeJobsExpected,
};
