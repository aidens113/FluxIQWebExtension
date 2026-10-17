import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { STORE_AT_START } from "../records.js";
import { ROOT } from "../shell/index.js";
import { invitationStore, invitationStoreText } from "../store.js";
import { arrivalSteps } from "./arrival-steps.js";

/**
 * The connection invitations waiting for the signed-in member that came with
 * a personal message, in the order the Received list shows them, enumerated
 * from `data/invitations.ts`: Ximena Ruiz, Lucia Romano and Chidi Nwosu. Pavel
 * Novák, Mara Okafor and Omar Farouk sent theirs without one, and the page and
 * newsletter invitations are not connection invitations.
 */
const MESSAGED = [
  { urn: "urn:gl:invitation:6981004", name: "Ximena Ruiz", message: "Hi Rafaela, we're both hiring data engineers in Rotterdam. Happy to swap notes on the market." },
  { urn: "urn:gl:invitation:6981295", name: "Lucia Romano", message: "Loved your post on structured interviews!" },
  { urn: "urn:gl:invitation:6981586", name: "Chidi Nwosu", message: "Hi Rafaela, Priya Nair suggested I reach out about the platform role." },
] as const;

const row = (urn: string) => `li[data-entity-urn="${urn}"]`;
const STORE_AFTER_ACCEPTING = invitationStoreText(invitationStore({ withdrawn: [], accepted: MESSAGED.map(({ urn }) => urn), ignored: [], sentByRun: [] }));

/**
 * Accepts exactly the messaged connection invitations and nothing else: no
 * Ignore, no page or newsletter invitation, no invitation without a note.
 * Accepting adds a connection and is not one of the acts a person is asked
 * about. The dataset is who was accepted and what they wrote.
 */
export const acceptMessagedInvitationsWorkflow: ScenarioWorkflow = {
  id: "accept-messaged-invitations",
  recordingDescription: "Demonstrates accepting only the received connection invitations that carry a message.",
  description: "Accept the received connection invitations that came with a personal message, leave every other invitation pending, and report who was accepted with their message.",
  recordingScript: [
    ...arrivalSteps("accept"),
    { id: "accept-open-received", operation: "navigate", path: `${ROOT}mynetwork/invitation-manager/` },
    { id: "accept-received-listed", operation: "waitForState", target: row(MESSAGED[0].urn), timeoutMs: 5000 },
    ...MESSAGED.flatMap(({ urn }, index): ScenarioStep[] => [
      { id: `accept-invitation-${index + 1}`, operation: "click", target: `${row(urn)} button:text-is("Accept")` },
      { id: `accept-invitation-${index + 1}-done`, operation: "waitForState", target: `${row(urn)} div:text-is("Accepted")`, timeoutMs: 5000 },
    ]),
    {
      id: "extract-accepted-invitations", operation: "extract", target: MESSAGED.map(({ urn }) => row(urn)).join(","),
      fields: { name: `a span[aria-hidden="true"]`, message: "blockquote" },
    },
    { id: "accept-complete", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "accept-starts-with-original-invitations", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
    extracted: [{ step: "extract-accepted-invitations", count: 3, records: MESSAGED.map(({ name, message }) => ({ name, message })) }],
    finalState: [{ id: "accept-only-messaged", subject: "invitation-store", predicate: "text", value: STORE_AFTER_ACCEPTING }],
    allowedConsoleErrors: ["status of 429"],
  },
};
