import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { memberNamed } from "../data/index.js";
import { STORE_AT_START } from "../records.js";
import { ROOT } from "../shell/index.js";
import { invitationStore, invitationStoreText, runInvitationUrn } from "../store.js";
import { arrivalSteps } from "./arrival-steps.js";

const MATTEO = memberNamed("Matteo Ricci");
const REQUEST_URN = runInvitationUrn({ memberUrn: MATTEO.urn });
const VISIBLE_SHOW_RESULTS = `div:text-is("Show results") >> visible=true`;
const ORGANIC_RESULTS_SHOWN = `section[aria-label="Search results"] ul[role="list"]:has(> li[data-urn^="urn:gl:member:"]:not([data-ad-slot]))`;

/** The store once exactly one request, to Matteo Ricci, has been added and nothing else changed. */
const STORE_AFTER_REQUEST = invitationStoreText(invitationStore({ withdrawn: [], accepted: [], ignored: [], sentByRun: [{ memberUrn: MATTEO.urn, note: "", flagged: false }] }));

/**
 * A connection request to the one Senior Data Engineer at Kade Energy,
 * Matteo Ricci, found through the people search's Current company filter, sent
 * without a note, then read back as the newest row of the Sent list. Kade
 * Energy has four other people a data-engineer search returns -- a Data
 * Engineer II, a Big Data Engineer, and two first connections, one of them its
 * Lead Data Engineer -- so the row matters. A connection request is a send:
 * the run asks before "Send without a note".
 */
export const connectKadeSeniorWorkflow: ScenarioWorkflow = {
  id: "connect-kade-senior",
  recordingDescription: "Demonstrates sending one connection request found through a company filter.",
  description: "Send a connection request without a note to Kade Energy's Senior Data Engineer, then read the request back from the Sent list.",
  recordingScript: [
    ...arrivalSteps("connect"),
    { id: "connect-type-keywords", operation: "type", target: "role:combobox:Search", value: "senior data engineer" },
    { id: "connect-submit-search", operation: "press", target: "role:combobox:Search", value: "Enter" },
    { id: "connect-all-results-shown", operation: "waitForState", target: "role:link:See all people results", timeoutMs: 5000 },
    { id: "connect-open-people-results", operation: "click", target: "role:link:See all people results" },
    { id: "connect-open-companies", operation: "click", target: `div[tabindex="0"]:text-is("Current company ▾")` },
    { id: "connect-choose-kade", operation: "check", target: "role:checkbox:Kade Energy", value: true },
    { id: "connect-apply-companies", operation: "click", target: VISIBLE_SHOW_RESULTS },
    { id: "connect-kade-shown", operation: "waitForState", target: ORGANIC_RESULTS_SHOWN, timeoutMs: 6000 },
    { id: "connect-open-request", operation: "click", target: `li[data-urn="${MATTEO.urn}"] button` },
    { id: "connect-send-without-note", operation: "click", target: "role:button:Send without a note" },
    { id: "connect-request-sent", operation: "waitForState", target: `div:text-is("Your invitation to ${MATTEO.name} was sent.")`, timeoutMs: 5000 },
    { id: "connect-open-sent", operation: "navigate", path: `${ROOT}mynetwork/invitation-manager/sent/` },
    { id: "connect-request-listed", operation: "waitForState", target: `li[data-entity-urn="${REQUEST_URN}"]`, timeoutMs: 5000 },
    {
      id: "extract-kade-request", operation: "extract", target: `li[data-entity-urn="${REQUEST_URN}"]`,
      fields: { name: `a span[aria-hidden="true"]`, headline: ":scope > div:nth-child(2) > div:nth-child(2)" },
    },
    { id: "connect-complete", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "connect-starts-with-original-invitations", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
    extracted: [{ step: "extract-kade-request", count: 1, records: [{ name: "Matteo Ricci", headline: "Senior Data Engineer at Kade Energy" }] }],
    finalState: [{ id: "connect-one-request-added", subject: "invitation-store", predicate: "text", value: STORE_AFTER_REQUEST }],
    allowedConsoleErrors: ["status of 429"],
  },
};
