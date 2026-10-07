import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { requestAuditExpected } from "./expected.js";

export const requestAuditWorkflow: ScenarioWorkflow = {
  id: "audit-pending-requests",
  description: "audit pending requests",
  recordingScript: [{"id":"audit-consent","operation":"click","target":"role:button:Allow all cookies"},{"id":"audit-notifications","operation":"waitForState","target":"role:dialog:Turn on notifications?","timeoutMs":8000},{"id":"audit-no-notifications","operation":"click","target":"role:button:Not now"},{"id":"audit-chat","operation":"waitForState","target":"role:dialog:Chat with Elena Sokolova","timeoutMs":8000},{"id":"audit-chat-close","operation":"click","target":"role:button:Close chat"},{"id":"audit-friends","operation":"click","target":"[role=\"banner\"] a[aria-label=\"Friends\"]"},{"id":"audit-see-all","operation":"click","target":"[role=\"main\"] a[href$=\"/friends/requests/\"]"},{"id":"audit-complete","operation":"waitForState","target":"[role=\"listitem\"]:has(a[href$=\"/people/marta-kowalczyk/\"])","timeoutMs":5000},{"id":"extract-pending-requests","operation":"extract","target":"[role=\"main\"] [role=\"listitem\"]","fields":{"name":"a[href*=\"/people/\"]:not([aria-hidden])","mutualFriends":"a[href*=\"/people/\"]:not([aria-hidden]) + div","url":"a[href*=\"/people/\"]:not([aria-hidden])@href"}}],
  expected: requestAuditExpected,
};
