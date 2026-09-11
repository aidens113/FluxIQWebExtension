// T1 coverage of the client wire mapping: the "Domain event type" column of
// the audit-recording mapping table as the extension actually sends it, and
// action-type normalization for commands coming back from the gateway.

import assert from "node:assert/strict";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../../actions/types";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "../../constants";
import { createWebAutomationRecordingEvent, normalizeWebAutomationActionType, webAutomationActionFromGatewayCommand } from "../gateway-mapping";

// The one failure record a rejected action type carries, in Core's taxonomy.
const unsupportedTypeFailure = { category: "blocked_by_capability_or_policy", code: "web.action.unsupported_type", retryable: false, stage: "dispatch" };

// Rows 1-19 of the mapping table, by client event kind (rows 3/4, 6/7 and 8/9 share a kind).
const wireRows: Array<[kind: string, eventType: string]> = [
  ["content.ready", WEB_AUTOMATION_EVENTS.clientReady],
  ["browser.tab", WEB_AUTOMATION_EVENTS.tabStateChanged],
  ["browser.navigation", WEB_AUTOMATION_EVENTS.pageNavigated],
  ["dom.click", WEB_AUTOMATION_EVENTS.elementClicked],
  ["dom.input", WEB_AUTOMATION_EVENTS.elementInputChanged],
  ["dom.change", WEB_AUTOMATION_EVENTS.elementChanged],
  ["dom.submit", WEB_AUTOMATION_EVENTS.formSubmitted],
  ["dom.keydown", WEB_AUTOMATION_EVENTS.keyboardPressed],
  ["dom.scroll", WEB_AUTOMATION_EVENTS.scrollChanged],
  ["dom.wheel", WEB_AUTOMATION_EVENTS.mouseWheel],
  ["dom.mutation", WEB_AUTOMATION_EVENTS.domMutated],
  ["dom.focus", WEB_AUTOMATION_EVENTS.elementFocused],
  ["dom.blur", WEB_AUTOMATION_EVENTS.elementBlurred],
  ["dom.snapshot", WEB_AUTOMATION_EVENTS.snapshotCaptured],
  ["action.result", WEB_AUTOMATION_EVENTS.actionExecuted],
  ["client.error", WEB_AUTOMATION_EVENTS.clientError]
];

for (const [kind, eventType] of wireRows) {
  const event = createWebAutomationRecordingEvent({ kind, sequence: 3, url: "https://example.test", title: "Example", eventTimestampMs: 30 });
  assert.equal(event.eventType, eventType, `${kind}: event type on the wire`);
  assert.equal(event.domainId, WEB_AUTOMATION_DOMAIN_ID, `${kind}: domainId at the top level`);
  assert.equal(event.metadata?.clientKind, kind, `${kind}: client kind kept in metadata`);
}
assert.equal(createWebAutomationRecordingEvent({ kind: "dom.unknown", sequence: 1, url: "https://example.test", title: "Example", eventTimestampMs: 1 }).eventType, WEB_AUTOMATION_EVENTS.clientError);

// Canonical action types pass unchanged.
for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
  assert.deepEqual(normalizeWebAutomationActionType(actionType), { ok: true, actionType });
}

// Legacy dotted aliases resolve to their canonical type, here and nowhere else in the domain.
const legacyAliases: Record<string, WebAutomationActionType> = {
  "browser.navigate": "web.browser.navigate",
  "dom.click": "web.dom.click",
  "dom.type": "web.dom.type",
  "dom.clear": "web.dom.clear",
  "dom.select": "web.dom.select",
  "dom.scroll": "web.dom.scroll",
  "dom.keypress": "web.dom.keypress",
  "dom.wait_for_selector": "web.dom.wait_for_selector",
  "dom.wait_for_text": "web.dom.wait_for_text",
  "dom.extract": "web.dom.extract",
  "dom.capture_snapshot": "web.dom.capture_snapshot"
};
for (const [alias, actionType] of Object.entries(legacyAliases)) {
  assert.deepEqual(normalizeWebAutomationActionType(alias), { ok: true, actionType }, alias);
}

// Anything else is rejected with Core's failure record, never rewritten into web.dom.extract.
for (const unknown of ["web.dom.hover", "dom.hover", "extract", "WEB.DOM.CLICK", " web.dom.click", "web.", ""]) {
  const normalized = normalizeWebAutomationActionType(unknown);
  assert.equal(normalized.ok, false, JSON.stringify(unknown));
  assert.deepEqual(normalized.ok ? undefined : normalized.failure, unsupportedTypeFailure, JSON.stringify(unknown));
  // Core drops a record its parser refuses, so the one this domain produces must survive it whole.
  assert.deepEqual(parseAutomationStudioFailureRecord(normalized.ok ? undefined : normalized.failure), unsupportedTypeFailure, JSON.stringify(unknown));
}
const emptyType = normalizeWebAutomationActionType("");
assert.equal(emptyType.ok ? undefined : emptyType.message, "Unsupported web automation action type: (missing)");

// Gateway commands.
assert.deepEqual(webAutomationActionFromGatewayCommand({
  commandId: "command.type",
  actionType: "dom.type",
  target: { selector: "input[name=q]" },
  parameters: { text: "ada" }
}), {
  commandId: "command.type",
  actionType: "web.dom.type",
  selector: "input[name=q]",
  text: "ada",
  options: { text: "ada" }
});
assert.deepEqual(webAutomationActionFromGatewayCommand({
  commandId: "command.scroll",
  actionType: "web.dom.scroll",
  parameters: { x: 0, y: 640 }
}), {
  commandId: "command.scroll",
  actionType: "web.dom.scroll",
  options: { x: 0, y: 640 }
});
const rejected = webAutomationActionFromGatewayCommand({ commandId: "command.hover", actionType: "web.dom.hover", target: { selector: "#menu" } });
assert.deepEqual(rejected, {
  commandId: "command.hover",
  status: "rejected",
  actionType: "web.dom.hover",
  message: "Unsupported web automation action type: web.dom.hover",
  failure: unsupportedTypeFailure
});
assert.equal("selector" in rejected, false, "a rejected command carries nothing to execute");
assert.equal(webAutomationActionFromGatewayCommand({ commandId: "command.legacy", actionType: "dom.hover" }).actionType, "dom.hover");
assert.equal("status" in webAutomationActionFromGatewayCommand({ commandId: "command.legacy", actionType: "dom.hover" }), true);

console.log("Web automation gateway mapping tests passed.");
