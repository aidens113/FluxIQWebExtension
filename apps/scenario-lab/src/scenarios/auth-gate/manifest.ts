import { createScenarioManifest } from "../../types.js";
import { authGateDemoCredentials } from "./constants.js";

/**
 * Corpus rows W18 and W19. Primary (W18): sign in with the stated demo
 * credentials, reach the protected account page, and read it. `expired`
 * (W19): the session expires before the protected page loads, so the
 * account request lands back on the sign-in page and the run must report
 * auth_required instead of reading anything.
 */
export const authGateManifest = createScenarioManifest({
  id: "auth-gate",
  title: "Auth gate",
  tags: ["auth", "forms", "password", "redirect", "session-expiry", "extraction"],
  seed: 120,
  startPath: "/scenarios/auth-gate/",
  capabilities: ["navigation", "forms", "mutation"],
  recordingScript: [
    { id: "enter-username", operation: "type", target: "testid:username", value: authGateDemoCredentials.username },
    { id: "enter-password", operation: "type", target: "testid:password", value: authGateDemoCredentials.password },
    { id: "submit-sign-in", operation: "click", target: "testid:sign-in" },
    { id: "account-loaded", operation: "waitForState", target: "testid:account-heading", timeoutMs: 5000 },
    {
      id: "read-account", operation: "extract", target: "testid:account-summary",
      fields: { holder: "testid:account-holder", plan: "testid:account-plan", balance: "testid:account-balance" },
    },
    { id: "account-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [
      { id: "sign-in-form-visible", subject: "sign-in-form", predicate: "visible", value: true },
      { id: "demo-username-stated", subject: "demo-username", predicate: "text", value: "demo.user" },
      { id: "expiry-notice-hidden", subject: "session-expired", predicate: "visible", value: false },
    ],
    recordingEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }],
    actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
    finalState: [
      { id: "on-account-page", subject: "document", predicate: "path", value: "/scenarios/auth-gate/account" },
      { id: "signed-in-user", subject: "signed-in-user", predicate: "text", value: "demo.user" },
      { id: "protected-content-visible", subject: "account-summary", predicate: "visible", value: true },
    ],
    extracted: [{ step: "read-account", count: 1, records: [{ holder: "Demo Customer", plan: "Team (annual)", balance: "$1,284.50" }] }],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "expired",
    description: "W19: arming expires the session, and a session signed in afterwards expires before the protected page loads. The account request answers 302 to the sign-in page with ?expired=1, which says the session expired.",
    arm: { operation: "expire-session" },
    expected: {
      finalState: [
        { id: "back-on-sign-in", subject: "document", predicate: "path", value: "/scenarios/auth-gate/" },
        { id: "expiry-notice-visible", subject: "session-expired", predicate: "visible", value: true },
        { id: "expiry-notice-says-expired", subject: "session-expired", predicate: "contains", value: "session expired" },
        { id: "protected-content-absent", subject: "account-summary", predicate: "exists", value: false },
      ],
      extracted: [],
      failure: { category: "auth_required" },
    },
  }],
  evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: true },
});
