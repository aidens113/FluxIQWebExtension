import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { saveQuillmarkRemoteExpected } from "./expected.js";

const heart = (key: string) => `article[data-jk="${key}"] h2 + span`;
const SENIOR_RUST = "9acf8f84c9c767ef";
const CONTRACT = "12989de62c149c5b";
const CUSTOMER_SUCCESS = "a31866ada1ad54e1";

/**
 * A person's recording: search for Quillmark, put the chat away, press the
 * hearts of its three remote UK jobs (the first save of a page load fails and
 * is pressed again), then open My jobs and read the saved list.
 */
export const saveQuillmarkRemoteWorkflow: ScenarioWorkflow = {
  id: "save-quillmark-remote",
  recordingDescription: "Demonstrates saving one employer's remote roles from search results and reading the saved list.",
  description: "Save Quillmark's fully remote UK jobs, keeping what was already saved, and read back the saved list.",
  recordingScript: [
    { id: "quillmark-accept-cookies", operation: "click", target: "role:button:Accept all" },
    { id: "quillmark-type-search", operation: "type", target: "input[name=\"q\"]", value: "Quillmark" },
    { id: "quillmark-find-jobs", operation: "click", target: "role:button:Find jobs" },
    { id: "quillmark-offer-shown", operation: "waitForState", target: "text=No thanks", timeoutMs: 9000 },
    { id: "quillmark-decline-offer", operation: "click", target: "text=No thanks" },
    { id: "quillmark-chat-opened", operation: "waitForState", target: "rf-assistant .fa-min", timeoutMs: 9000 },
    { id: "quillmark-minimise-chat", operation: "click", target: "rf-assistant .fa-min" },
    { id: "quillmark-save-first-try", operation: "click", target: heart(SENIOR_RUST) },
    { id: "quillmark-save-refused", operation: "waitForState", target: "text=Couldn't save this job. Try again.", timeoutMs: 3000 },
    { id: "quillmark-save-senior-rust", operation: "click", target: heart(SENIOR_RUST) },
    { id: "quillmark-senior-rust-saved", operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
    { id: "quillmark-save-contract", operation: "click", target: heart(CONTRACT) },
    { id: "quillmark-contract-saved", operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
    { id: "quillmark-save-customer-success", operation: "click", target: heart(CUSTOMER_SUCCESS) },
    { id: "quillmark-customer-success-saved", operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
    { id: "quillmark-open-my-jobs", operation: "click", target: "header a[href=\"/scenarios/job-board/myjobs\"]" },
    { id: "quillmark-saved-shown", operation: "waitForState", target: "testid:saved-list", timeoutMs: 5000 },
    {
      id: "extract-saved-after-quillmark",
      operation: "extract",
      target: "main ol li",
      fields: { title: "a", company: ":scope > span:nth-of-type(1)", location: ":scope > span:nth-of-type(2)" },
    },
    { id: "quillmark-saved", operation: "checkpoint" },
  ],
  expected: saveQuillmarkRemoteExpected,
};
