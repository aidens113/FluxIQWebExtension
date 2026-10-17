import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { memberNamed } from "../data/index.js";
import { STORE_AT_START } from "../records.js";
import { arrivalSteps } from "./arrival-steps.js";

const PIETER = memberNamed("Pieter Groen");
const VISIBLE_SHOW_RESULTS = `div:text-is("Show results") >> visible=true`;
const ORGANIC_RESULTS_SHOWN = `section[aria-label="Search results"] ul[role="list"]:has(> li[data-urn^="urn:gl:member:"]:not([data-ad-slot]))`;
const CONTACT_INFO = `div[role="dialog"][aria-label="Contact info"]`;

/**
 * A journey: the global search, the people results, two filters -- first
 * connections, then Kade Energy as current company, which leaves Ricardo
 * Alves and Pieter Groen -- the Lead Data Engineer's profile, and its Contact
 * info dialog, where a first connection's email is shown. Only a first
 * connection's contact info carries an email; the other Kade Energy data
 * engineers are second-degree and show none.
 */
export const kadeLeadContactWorkflow: ScenarioWorkflow = {
  id: "kade-lead-contact",
  recordingDescription: "Demonstrates a search, two filters, a profile and its contact info.",
  description: "Find the first-degree Lead Data Engineer at Kade Energy through the people search, open the profile, and read the name and email from its contact info.",
  recordingScript: [
    ...arrivalSteps("contact"),
    { id: "contact-type-keywords", operation: "type", target: "role:combobox:Search", value: "data engineer" },
    { id: "contact-submit-search", operation: "press", target: "role:combobox:Search", value: "Enter" },
    { id: "contact-all-results-shown", operation: "waitForState", target: "role:link:See all people results", timeoutMs: 5000 },
    { id: "contact-open-people-results", operation: "click", target: "role:link:See all people results" },
    { id: "contact-open-connections", operation: "click", target: `div[tabindex="0"]:text-is("Connections ▾")` },
    { id: "contact-choose-first-degree", operation: "check", target: "role:checkbox:1st", value: true },
    { id: "contact-apply-connections", operation: "click", target: VISIBLE_SHOW_RESULTS },
    { id: "contact-first-degree-shown", operation: "waitForState", target: ORGANIC_RESULTS_SHOWN, timeoutMs: 6000 },
    { id: "contact-open-companies", operation: "click", target: `div[tabindex="0"]:text-is("Current company ▾")` },
    { id: "contact-choose-kade", operation: "check", target: "role:checkbox:Kade Energy", value: true },
    { id: "contact-apply-companies", operation: "click", target: VISIBLE_SHOW_RESULTS },
    { id: "contact-lead-shown", operation: "waitForState", target: `li[data-urn="${PIETER.urn}"]`, timeoutMs: 6000 },
    { id: "contact-open-profile", operation: "click", target: `li[data-urn="${PIETER.urn}"] a:has(span[aria-hidden="true"])` },
    { id: "contact-profile-shown", operation: "waitForState", target: "role:button:Contact info", timeoutMs: 5000 },
    { id: "contact-open-contact-info", operation: "click", target: "role:button:Contact info" },
    { id: "contact-info-shown", operation: "waitForState", target: `${CONTACT_INFO} a[href^="mailto:"]`, timeoutMs: 5000 },
    { id: "extract-kade-lead-contact", operation: "extract", target: CONTACT_INFO, fields: { name: "h2", email: `a[href^="mailto:"]` } },
    { id: "contact-complete", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "contact-starts-with-original-invitations", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
    extracted: [{ step: "extract-kade-lead-contact", count: 1, records: [{ name: "Pieter Groen", email: "pieter@example.com" }] }],
    finalState: [{ id: "contact-changes-nothing", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
    allowedConsoleErrors: ["status of 429"],
  },
};
