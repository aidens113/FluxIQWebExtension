import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { collapseDockSteps, openingSteps } from "../steps/index.js";
import { kilnNotesExpected } from "./expected.js";

const SAVED = "/scenarios/photo-social/tamsin.reyes/saved/";
const NAME = "Kiln Theory notes";
/** A post in the "Add from saved" picker, which names it by nothing but its photo's alt text. */
const pick = (day: string) => `[role="dialog"] [role="checkbox"]:has(img[alt^="Photo by Kiln Theory on ${day}."])`;

/**
 * A new collection made from the Saved page: name it, pick the two Kiln
 * Theory posts from what is saved, then read every collection tile back off
 * the Saved page.
 */
export const kilnNotesWorkflow: ScenarioWorkflow = {
  id: "kiln-notes",
  recordingDescription: "Demonstrates creating a collection from the saved page, choosing its posts from saved posts, and reading the collections back.",
  description: "On the Saved page, make Kiln Theory notes from the two saved Kiln Theory posts, then read each collection and how many posts it holds.",
  recordingScript: [
    ...openingSteps("kiln-notes"),
    { id: "kiln-notes-open-saved", operation: "navigate", path: SAVED },
    ...collapseDockSteps("kiln-notes"),
    { id: "kiln-notes-new-collection", operation: "click", target: "role:button:New collection" },
    { id: "kiln-notes-name", operation: "type", target: `input[placeholder="Collection name"]`, value: NAME },
    { id: "kiln-notes-next", operation: "click", target: "role:button:Next" },
    { id: "kiln-notes-pick-diagram", operation: "click", target: pick("September 19, 2026") },
    { id: "kiln-notes-pick-chart", operation: "click", target: pick("August 30, 2026") },
    { id: "kiln-notes-done", operation: "click", target: "role:button:Done" },
    { id: "kiln-notes-created", operation: "waitForState", target: `main h1:text-is("${NAME}")`, timeoutMs: 5000 },
    { id: "kiln-notes-back-to-saved", operation: "navigate", path: SAVED },
    { id: "extract-kiln-notes", operation: "extract", target: `main a[href*="/saved/"]:not([href$="/all-posts/"])`, fields: { collection: ":scope > span:first-of-type", posts: ":scope > span:last-of-type > span" } },
    { id: "kiln-notes-read", operation: "checkpoint" },
  ],
  expected: kilnNotesExpected,
};
