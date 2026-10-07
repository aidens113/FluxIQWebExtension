import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { SENT_INVITATIONS } from "../data/index.js";
import { staleConnectionRequests } from "../records.js";
import { ROOT } from "../shell/index.js";
import { staleRequestAuditExpected } from "./expected.js";

const people = SENT_INVITATIONS.filter(({ kind }) => kind === "person");
const row = (urn: string) => `li[data-entity-urn="${urn}"]`;

/** A read-only reference path; the answer is independently enumerated in expected.ts. */
export const staleRequestAuditWorkflow: ScenarioWorkflow = {
  id: "audit-stale-requests",
  description: "Report the month-old unanswered connection requests without changing any invitation.",
  recordingScript: [
    { id: "audit-app-prompt", operation: "waitForState", target: 'div:text-is("Not now")', timeoutMs: 15_000 },
    { id: "audit-dismiss-app", operation: "click", target: 'div:text-is("Not now")' },
    { id: "audit-conversation", operation: "waitForState", target: "role:button:Close your conversation with Priya Nair", timeoutMs: 15_000 },
    { id: "audit-close-conversation", operation: "click", target: "role:button:Close your conversation with Priya Nair" },
    { id: "audit-consent", operation: "click", target: "role:button:Accept" },
    { id: "audit-sent", operation: "navigate", path: `${ROOT}mynetwork/invitation-manager/sent/` },
    { id: "audit-people", operation: "click", target: `role:button:People (${people.length})` },
    { id: "audit-more-ready", operation: "waitForState", target: "role:button:Show more", timeoutMs: 5000 },
    { id: "audit-show-more", operation: "click", target: "role:button:Show more" },
    { id: "audit-retry-ready", operation: "waitForState", target: "role:button:Retry", timeoutMs: 5000 },
    { id: "audit-retry", operation: "click", target: "role:button:Retry" },
    { id: "audit-second-batch", operation: "waitForState", target: row(people[10]!.urn), timeoutMs: 5000 },
    { id: "audit-more-again", operation: "click", target: "role:button:Show more" },
    { id: "audit-all-loaded", operation: "waitForState", target: row(people.at(-1)!.urn), timeoutMs: 5000 },
    { id: "extract-stale-request-audit", operation: "extract", target: staleConnectionRequests().map(({ urn }) => row(urn)).join(","), fields: { name: 'a span[aria-hidden="true"]' } },
    { id: "audit-complete", operation: "checkpoint" },
  ],
  expected: staleRequestAuditExpected,
};
