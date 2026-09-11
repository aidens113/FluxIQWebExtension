import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";

const publishedFacts: ExpectedFact[] = [
  { id: "draft-published", subject: "publish-result", predicate: "text", value: "Draft published" },
  { id: "consent-banner-gone", subject: "consent-banner", predicate: "exists", value: false },
];

/**
 * Corpus rows W12-W14. The manifest's own script is W12 (the primary
 * workflow); `consent-then-click` is W13 and `interstitial` is W14. Each
 * variant is armed by one fixture mutation and changes only its own surface.
 */
export const modalFlowsManifest = createScenarioManifest({
  id: "modal-flows",
  title: "Modal flows",
  tags: ["modal", "focus-trap", "consent-banner", "interstitial", "native-confirm"],
  seed: 117,
  startPath: "/scenarios/modal-flows/",
  capabilities: ["forms", "mutation"],
  recordingScript: [
    { id: "open-invite", operation: "click", target: "testid:open-invite" },
    { id: "enter-email", operation: "type", target: "testid:invite-email", value: "ada@example.test" },
    { id: "choose-role", operation: "select", target: "testid:invite-role", value: "editor" },
    { id: "confirm-invite", operation: "click", target: "testid:invite-confirm" },
    { id: "invite-sent", operation: "checkpoint" },
  ],
  expected: {
    recordingEvents: [{ type: "web.element.clicked", count: 2 }, { type: "web.element.input_changed", count: 1 }, { type: "web.element.changed", count: 1 }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
    finalState: [
      { id: "invite-sent", subject: "invite-result", predicate: "text", value: "Invitation sent to ada@example.test (Editor)" },
      { id: "invite-dialog-closed", subject: "invite-dialog", predicate: "visible", value: false },
    ],
    allowedConsoleErrors: [],
  },
  workflows: [
    {
      id: "consent-then-click",
      description: "W13: dismiss the cookie-consent banner, then click Publish draft, which the banner covers until it is dismissed.",
      recordingScript: [
        { id: "accept-cookies", operation: "click", target: "testid:consent-accept" },
        { id: "publish-draft", operation: "click", target: "testid:publish-draft" },
        { id: "published", operation: "checkpoint" },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.clicked", count: 2 }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }],
        finalState: publishedFacts,
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "banner-absent",
        description: "The consent banner never renders, so the recorded dismissal has no target; the run must still publish the draft.",
        arm: { operation: "remove-consent-banner" },
        expected: { finalState: [...publishedFacts] },
      }],
    },
    {
      id: "interstitial",
      description: "W14: click Add section twice.",
      recordingScript: [
        { id: "add-first-section", operation: "click", target: "testid:add-section" },
        { id: "add-second-section", operation: "click", target: "testid:add-section" },
        { id: "sections-added", operation: "checkpoint" },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.clicked", count: 2 }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }],
        finalState: [
          { id: "two-sections", subject: "section-count", predicate: "text", value: "2 sections" },
          { id: "no-offer", subject: "interstitial", predicate: "exists", value: false },
        ],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "armed",
        description: "An unrecorded offer (role=dialog, aria-modal) appears after the first Add section and blocks the page until closed; the run must stop for the user rather than click through or dismiss it.",
        arm: { operation: "arm-interstitial" },
        expected: {
          failure: { category: "user_intervention_required" },
          finalState: [
            { id: "one-section", subject: "section-count", predicate: "text", value: "1 section" },
            { id: "offer-blocking", subject: "interstitial", predicate: "visible", value: true },
          ],
        },
      }],
    },
  ],
});
