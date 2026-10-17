import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { remoteEasyApplyExpected } from "./expected.js";

/** The seven quick-apply jobs' keys, newest first: the cards the recording read. */
const EASY_KEYS = ["9cb6af983905a661", "f5944ce31f210a53", "eb2e64386fa20bec", "d84f0b6ebf4877fc", "4ca89d5aeb910da6", "feb2238d8a72860d", "b81d28f55b7e47ea"] as const;

/**
 * A person's recording: an empty search, Remote only, newest first, fifty a
 * page so all 28 remote jobs are on one, and the quick-apply cards that show
 * a salary read off it.
 */
export const remoteEasyApplyWorkflow: ScenarioWorkflow = {
  id: "remote-easy-apply",
  recordingDescription: "Demonstrates a filtered job search and reading the quick-apply roles from every result.",
  description: "Collect every fully remote UK job that takes Rolefinch's Easily apply and shows a salary, each once, newest first.",
  recordingScript: [
    { id: "easy-accept-cookies", operation: "click", target: "role:button:Accept all" },
    { id: "easy-find-jobs", operation: "click", target: "role:button:Find jobs" },
    { id: "easy-offer-shown", operation: "waitForState", target: "text=No thanks", timeoutMs: 9000 },
    { id: "easy-decline-offer", operation: "click", target: "text=No thanks" },
    { id: "easy-open-remote-filter", operation: "click", target: "role:button:Remote" },
    { id: "easy-remote-only", operation: "click", target: "role:link:Remote only" },
    { id: "easy-sort-by-date", operation: "click", target: "role:link:date" },
    { id: "easy-fifty-per-page", operation: "select", target: "select[name=\"limit\"]", value: "50" },
    { id: "easy-all-listed", operation: "waitForState", target: `article[data-jk="${EASY_KEYS[6]}"]`, timeoutMs: 5000 },
    {
      id: "extract-remote-easy-apply",
      operation: "extract",
      target: EASY_KEYS.map((key) => `article[data-jk="${key}"]`).join(", "),
      fields: { title: "h2 a", company: ":scope > div:nth-of-type(2) > span:nth-of-type(1)", salary: ":scope > div:nth-of-type(3)" },
    },
    { id: "easy-collected", operation: "checkpoint" },
  ],
  expected: remoteEasyApplyExpected,
};
