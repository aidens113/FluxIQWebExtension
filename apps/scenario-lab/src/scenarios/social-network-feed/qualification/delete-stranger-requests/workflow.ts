import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { overlaySteps } from "../steps/index.js";
import { deleteStrangerRequestsExpected } from "./expected.js";

const card = (slug: string) => `[role="listitem"]:has(a[href$="/people/${slug}/"])`;
const PROFILE_LINK = "a[href*=\"/people/\"]:not([aria-hidden])";
/** A card that has been answered and was not confirmed: no Confirm button and no Message link, so it says Request removed. */
const REMOVED_CARD = "[role=\"main\"] [role=\"listitem\"]:not(:has([aria-label=\"Confirm\"])):not(:has(a[href*=\"/messages/t/\"]))";

/**
 * Opens the complete request list past the four-card preview, deletes the one
 * request with no mutual friends, and reads back every card the list shows as
 * removed.
 */
export const deleteStrangerRequestsWorkflow: ScenarioWorkflow = {
  id: "delete-stranger-requests",
  recordingDescription: "Demonstrates removing only the request rows that meet a condition and reading the result back.",
  description: "Delete every friend request from someone with no mutual friends -- only Diego Alvarez, who is past the preview -- and read back the requests shown as removed.",
  recordingScript: [
    ...overlaySteps("strangers"),
    { id: "strangers-open-friends", operation: "click", target: "[role=\"banner\"] a[aria-label=\"Friends\"]" },
    { id: "strangers-friends-open", operation: "waitForState", target: "[role=\"main\"] a[href$=\"/friends/requests/\"]", timeoutMs: 5000 },
    { id: "strangers-see-all", operation: "click", target: "[role=\"main\"] a[href$=\"/friends/requests/\"]" },
    { id: "strangers-all-listed", operation: "waitForState", target: card("marta-kowalczyk"), timeoutMs: 5000 },
    { id: "strangers-delete-diego", operation: "click", target: `${card("diego-alvarez")} [aria-label="Delete"]` },
    { id: "strangers-diego-removed", operation: "waitForState", target: `${card("diego-alvarez")}:not(:has([role="button"]))`, timeoutMs: 3000 },
    { id: "extract-removed-requests", operation: "extract", target: REMOVED_CARD, fields: { name: PROFILE_LINK, url: `${PROFILE_LINK}@href` } },
    { id: "removed-requests-extracted", operation: "checkpoint" },
  ],
  expected: deleteStrangerRequestsExpected,
};
