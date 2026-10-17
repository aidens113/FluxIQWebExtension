import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { halvardCareersRolesExpected } from "./expected.js";

const SITE_RELIABILITY = "f38bde02a8f06cc4";

/**
 * A person's recording: search Rolefinch by title and town, put the chat
 * away, open the Site Reliability Engineer job, follow its apply link into
 * the new tab Halvard Systems' careers site opens in, answer its cookie bar,
 * open its list of all open roles and read it -- applying for nothing.
 */
export const halvardCareersRolesWorkflow: ScenarioWorkflow = {
  id: "halvard-careers-roles",
  recordingDescription: "Demonstrates a search by title and town, following a job to its employer's careers site, and reading that site's open roles.",
  description: "From Rolefinch's Site Reliability Engineer job in Leeds, reach Halvard Systems' careers site without applying and read every open role it lists.",
  recordingScript: [
    { id: "careers-accept-cookies", operation: "click", target: "role:button:Accept all" },
    { id: "careers-type-title", operation: "type", target: "input[name=\"q\"]", value: "Site Reliability Engineer" },
    { id: "careers-type-town", operation: "type", target: "input[name=\"l\"]", value: "Leeds" },
    { id: "careers-find-jobs", operation: "click", target: "role:button:Find jobs" },
    { id: "careers-offer-shown", operation: "waitForState", target: "text=No thanks", timeoutMs: 9000 },
    { id: "careers-decline-offer", operation: "click", target: "text=No thanks" },
    { id: "careers-chat-opened", operation: "waitForState", target: "rf-assistant .fa-min", timeoutMs: 9000 },
    { id: "careers-minimise-chat", operation: "click", target: "rf-assistant .fa-min" },
    { id: "careers-open-posting", operation: "click", target: `article[data-jk="${SITE_RELIABILITY}"] h2 a` },
    { id: "careers-posting-shown", operation: "waitForState", target: "role:link:Apply on company site", timeoutMs: 6000 },
    { id: "careers-apply-on-company-site", operation: "click", target: "role:link:Apply on company site" },
    // A new tab is waited for as long as a browser can take to start one: up to 30 s on a loaded machine.
    { id: "careers-site", operation: "switchTab", path: "/scenarios/job-board/careers/halvard/jobs/HS-3312", timeoutMs: 30_000 },
    { id: "careers-accept-site-cookies", operation: "click", target: "role:button:Accept" },
    { id: "careers-all-open-roles", operation: "click", target: "role:link:All open roles" },
    { id: "careers-roles-shown", operation: "waitForState", target: "role:heading:Open roles", timeoutMs: 5000 },
    { id: "extract-halvard-careers-roles", operation: "extract", target: "main ul li", fields: { title: "a", location: "span", link: "a@href" } },
    { id: "careers-roles-read", operation: "checkpoint" },
  ],
  expected: halvardCareersRolesExpected,
};
