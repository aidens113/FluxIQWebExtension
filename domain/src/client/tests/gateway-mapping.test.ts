// T1 coverage of the client wire mapping: the "Domain event type" column of
// the audit-recording mapping table as the extension actually sends it, and
// action-type normalization for commands coming back from the gateway.

import assert from "node:assert/strict";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionResult, type WebAutomationActionType } from "../../actions/types";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "../../constants";
import { outputTargetFromPayload, webAutomationOutputPayload } from "../../output-nodes";
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT } from "../../sensitivity";
import { createWebAutomationRecordingEvent, normalizeWebAutomationActionType, webAutomationActionFromGatewayCommand, webAutomationActionResultPayload } from "../gateway-mapping";

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

// -- The frame an interaction was recorded in, end to end ---------------------
// A command addressed to a child frame has to know which frame, and the only
// place that survives is the recorded event. `sourceId` names the tab and frame
// as text nothing parses; `payload.browserFrameId` is the field the output
// payload reads and the parameter lift turns back into `action.frameId`.

const framedEvent = createWebAutomationRecordingEvent(
  { kind: "dom.click", sequence: 4, url: "https://example.test", title: "Example", eventTimestampMs: 40, element: { selector: "#save", tagName: "button" } },
  { tabId: 12, frameId: 3 }
);
assert.equal(framedEvent.payload?.browserFrameId, 3, "the recorded frame is on the payload, not only inside sourceId");
assert.equal(framedEvent.sourceId, "tab:12:frame:3");
assert.equal(
  createWebAutomationRecordingEvent({ kind: "dom.click", sequence: 5, url: "https://example.test", title: "Example", eventTimestampMs: 50 }, { tabId: 12, frameId: 0 }).payload?.browserFrameId,
  0,
  "frame 0 is the top frame, not an absent frame"
);
assert.equal(
  "browserFrameId" in (createWebAutomationRecordingEvent({ kind: "dom.click", sequence: 6, url: "https://example.test", title: "Example", eventTimestampMs: 60 }, { tabId: 12 }).payload ?? {}),
  false,
  "an event recorded with no frame claims none"
);

// A child frame's document path, end to end: recorded event -> parameters -> command.
const childFrameEvent = createWebAutomationRecordingEvent(
  { kind: "dom.click", sequence: 10, url: "http://127.0.0.1:5174/scenarios/iframe-checkout/payment?session=tok-123", title: "Payment", eventTimestampMs: 100, element: { selector: "#pay", tagName: "button" } },
  { tabId: 12, frameId: 4 }
);
const childFrameCommand = webAutomationActionFromGatewayCommand({ commandId: "command.child-frame", actionType: "web.dom.click", target: { selector: "#pay" }, parameters: webAutomationOutputPayload("web.dom.click", childFrameEvent.payload ?? {}) });
assert.equal("status" in childFrameCommand ? undefined : childFrameCommand.frameUrlPath, "/scenarios/iframe-checkout/payment");
assert.equal("status" in childFrameCommand ? undefined : childFrameCommand.frameId, 4);

// -- A recorded tab change ----------------------------------------------------
// The stored payload keeps only the two declared fields, so a tab id or a full
// URL a caller put beside them never reaches the recording.
const tabChange = { operation: "switch" as const, urlPath: "/scenarios/multi-tab/details", tabId: 41, url: "http://127.0.0.1:4173/scenarios/multi-tab/details?session=tok-123" };
const tabEvent = createWebAutomationRecordingEvent({ kind: "browser.tab", sequence: 7, url: "http://127.0.0.1:4173/scenarios/multi-tab/details", title: "Details", eventTimestampMs: 70, tab: tabChange });
assert.equal(tabEvent.eventType, WEB_AUTOMATION_EVENTS.tabStateChanged);
assert.deepEqual(tabEvent.payload?.tab, { operation: "switch", urlPath: "/scenarios/multi-tab/details" });
assert.deepEqual(createWebAutomationRecordingEvent({ kind: "browser.tab", sequence: 8, url: "https://example.test", title: "Example", eventTimestampMs: 80, tab: { operation: "close" } }).payload?.tab, { operation: "close" });
assert.equal(
  "tab" in (createWebAutomationRecordingEvent({ kind: "browser.tab", sequence: 9, url: "https://example.test", title: "Example", eventTimestampMs: 90, metadata: { recordingState: "started" } }).payload ?? {}),
  false,
  "the recording-start marker carries no tab"
);
const tabCommand = webAutomationActionFromGatewayCommand({ commandId: "command.tab", actionType: "web.browser.tab", parameters: webAutomationOutputPayload("web.browser.tab", tabEvent.payload ?? {}) });
assert.deepEqual("status" in tabCommand ? undefined : tabCommand.tab, { operation: "switch", urlPath: "/scenarios/multi-tab/details" }, "a recorded switch reaches the command as its path alone");

// -- A run-time request nobody answered ---------------------------------------
// An unanswered upload request is refused the way an unanswered secret is: a
// user-intervention refusal naming the parameter and path, not an unreadable
// file list.
const unansweredUpload = webAutomationActionFromGatewayCommand({ commandId: "command.upload", actionType: "web.dom.upload", parameters: { selector: "#attachment", upload: { $state: { path: "web.upload.attachment" } } } });
const unansweredSecret = webAutomationActionFromGatewayCommand({ commandId: "command.secret", actionType: "web.dom.type", parameters: { selector: "#password", text: { $state: { path: "web.secret.password" } } } });
assert.equal("status" in unansweredUpload ? unansweredUpload.message : undefined, "Not dispatched: these parameters need values supplied at run time that this run did not supply: upload (web.upload.attachment)");
assert.equal("status" in unansweredUpload ? unansweredUpload.failure.code : undefined, "status" in unansweredSecret ? unansweredSecret.failure.code : "(secret dispatched)");

// The whole chain: recorded event -> replayable parameters -> action command.
const framedParameters = webAutomationOutputPayload("web.dom.click", framedEvent.payload ?? {});
const framedCommand = webAutomationActionFromGatewayCommand({
  commandId: "command.framed",
  actionType: "web.dom.click",
  target: { selector: "#save" },
  parameters: framedParameters
});
assert.equal("status" in framedCommand, false, "the framed command is not a rejection");
assert.equal((framedCommand as { frameId?: number }).frameId, 3, "the recorded frame reaches action.frameId");

// -- The recorded element's identity, end to end ------------------------------
// The whole point of a fingerprint is that the page can recognize a control
// again after its selector, id or class have drifted. It reaches the content
// script two ways: inside the raw `options` bag, which is how the resolver
// reads it today, and now on a declared `element` field the compiler checks.
// Both must be live, and both must say the same thing.

// An element descriptor as `content/describe-element.ts` produces one.
const recordedElement = {
  selector: "#save-settings",
  tagName: "button",
  id: "save-settings",
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Save",
  visibleText: "Save changes",
  implicitRole: "button",
  classNames: ["btn", "btn-primary"],
  attributes: { id: "save-settings", "data-testid": "save-changes" }
};

const identityEvent = createWebAutomationRecordingEvent({
  kind: "dom.click", sequence: 7, url: "https://example.test/settings", title: "Settings", eventTimestampMs: 70, element: recordedElement
});
const identityParameters = webAutomationOutputPayload("web.dom.click", identityEvent.payload ?? {});
// `dispatchWebAutomationOutput` builds the wire target from the node's own
// parameters, so the command below is assembled exactly as the gateway does it.
const identityTarget = outputTargetFromPayload(identityParameters);
const identityCommand = webAutomationActionFromGatewayCommand({
  commandId: "command.identity",
  actionType: "web.dom.click",
  ...(identityTarget ? { target: identityTarget } : {}),
  parameters: identityParameters
}) as unknown as { element?: Record<string, unknown>; options?: { element?: unknown }; selector?: string };

assert.equal(identityCommand.selector, "#save-settings", "the selector still reaches the command");
assert.ok(identityCommand.element, "a DOM-scoped action arrives with its element descriptor");
assert.equal(identityCommand.element?.testId, "save-changes", "the highest weighted identity signal survives dispatch");
assert.equal(identityCommand.element?.accessibleName, "Save changes");
assert.equal(identityCommand.element?.label, "Save");
assert.equal(identityCommand.element?.visibleText, "Save changes");
// `implicitRole` was dropped by `elementFingerprint` until this change. A page
// that authors no `role` attribute has no `role` field at all, so without it a
// replay reaches the page with no semantic signal to match on.
assert.equal(identityCommand.element?.implicitRole, "button", "the implied role is a matching signal, not recorder trivia");
// The declared field and the untyped path the resolver reads must not drift
// while both exist.
assert.deepEqual(identityCommand.element, identityCommand.options?.element, "the declared field and options.element are the same identity");

// Core's `prepareElementTargetAction` runs on every policy output dispatch and
// writes a normalized element target back as `parameters.target`. It builds
// that fingerprint from the parameters' own top-level keys and never looks
// inside `parameters.element`, so with no runtime candidates to match it is a
// lossy copy: `{ selector, statePath }` against the eleven signals the recorder
// captured. `outputTargetFromPayload` used to prefer it, collapsing the wire
// target to a bare selector; w3-target-signal-order reordered the chain so the
// adapted copy wins only when Core actually matched a candidate. Here it matched
// nothing, so the recorder's richer fingerprint is kept.
const preparedParameters = {
  ...identityParameters,
  target: { kind: "element", fingerprint: { selector: "#save-settings", statePath: "web.elements.save.changes" }, source: "runtime" }
};
const preparedTarget = outputTargetFromPayload(preparedParameters);
const preparedElement = preparedTarget?.element as Record<string, unknown> | undefined;
assert.equal(preparedElement?.selector, "#save-settings", "the prepared target keeps its selector");
assert.equal(preparedElement?.testId, "save-changes", "Core matching nothing must not strip the recorder's signals from the wire target");
const preparedCommand = webAutomationActionFromGatewayCommand({
  commandId: "command.prepared",
  actionType: "web.dom.click",
  ...(preparedTarget ? { target: preparedTarget } : {}),
  parameters: preparedParameters
}) as unknown as { element?: Record<string, unknown>; options?: { element?: unknown } };
assert.equal(preparedCommand.element?.testId, "save-changes", "the declared field keeps the recorded identity Core's normalization dropped");
assert.equal(preparedCommand.element?.implicitRole, "button");
assert.deepEqual(preparedCommand.element, preparedCommand.options?.element, "the declared field is never poorer than options.element");

// When Core did match a runtime candidate the target's copy describes the
// element the page really has, and it wins over the recorded one, which may be
// stale. `selectedCandidate` on the adapted target is what says so.
const adaptedParameters = {
  ...identityParameters,
  target: {
    kind: "element",
    fingerprint: recordedElement,
    candidates: [{ candidateId: "save-changes", selector: "#settings-save", testId: "save-changes", tagName: "button" }],
    selectedCandidate: { candidateId: "save-changes", confidence: 0.91, matchedSignals: ["testId"], failedSignals: [] }
  }
};
const adaptedTarget = outputTargetFromPayload(adaptedParameters);
const adaptedCommand = webAutomationActionFromGatewayCommand({
  commandId: "command.adapted",
  actionType: "web.dom.click",
  ...(adaptedTarget ? { target: adaptedTarget } : {}),
  parameters: adaptedParameters
}) as unknown as { element?: Record<string, unknown> };
assert.equal(adaptedCommand.element?.selector, "#settings-save", "the adapted target's element wins over the recorded one");

// A command sent as a raw element target names the fingerprint `fingerprint`.
const rawFingerprintCommand = webAutomationActionFromGatewayCommand({
  commandId: "command.raw-fingerprint",
  actionType: "web.dom.click",
  target: { kind: "element", fingerprint: { selector: "#save", tagName: "button", testId: "save" } },
  parameters: {}
}) as unknown as { element?: Record<string, unknown> };
assert.equal(rawFingerprintCommand.element?.testId, "save", "target.fingerprint is read as well as target.element");

// An object with no identifying signal is not an identity, and must not be
// dispatched as an empty one.
const unidentifiedCommand = webAutomationActionFromGatewayCommand({
  commandId: "command.unidentified",
  actionType: "web.dom.click",
  target: { selector: "#anything", element: { unrelated: true } },
  parameters: {}
});
assert.equal("element" in unidentifiedCommand, false, "an empty fingerprint is absent, not an empty object");
// An action that never had a target gains no element field either.
assert.equal("element" in webAutomationActionFromGatewayCommand({ commandId: "command.navigate", actionType: "web.browser.navigate", parameters: { url: "https://example.test" } }), false);

// -- The validation an action checked, on the wire ----------------------------
// The content script proves every action's post-condition and says what it
// expected and what it saw. Until now the result mapping dropped it, so the
// domain could name a failure — OUTPUT_NOT_OBSERVED is defined as carrying
// `expected` and `actual` — and never show the evidence behind it.

const failedValidationResult: WebAutomationActionResult = {
  commandId: "command.validated",
  actionType: "web.dom.click",
  status: "failed",
  validation: { status: "failed", expected: "the settings dialog to close", actual: "the settings dialog is still open" },
  message: "The click did not take effect.",
  url: "https://example.test/settings",
  startedAt: 100,
  finishedAt: 140
};
assert.deepEqual(
  webAutomationActionResultPayload(failedValidationResult).validation,
  { status: "failed", expected: "the settings dialog to close", actual: "the settings dialog is still open" },
  "a failed validation reaches the domain with both sides of the comparison"
);
assert.deepEqual(
  webAutomationActionResultPayload({ ...failedValidationResult, status: "succeeded", validation: { status: "passed", expected: "the dialog to close", actual: "the dialog closed" } }).validation,
  { status: "passed", expected: "the dialog to close", actual: "the dialog closed" },
  "a passing validation is evidence too, not only a failing one"
);
assert.deepEqual(
  webAutomationActionResultPayload({ ...failedValidationResult, status: "succeeded", validation: { status: "none", reason: "evidence-only" } }).validation,
  { status: "none", reason: "evidence-only" },
  "an action with no post-condition still says why it has none"
);
// A result assembled before validations existed carries none, and must not gain
// an invented one: `gateway-payloads.ts` replays stored results through here.
assert.equal(
  "validation" in webAutomationActionResultPayload({ commandId: "c", actionType: "web.dom.click", status: "succeeded", startedAt: 1, finishedAt: 2 } as unknown as WebAutomationActionResult),
  false,
  "an absent validation stays absent"
);

// -- A sensitive control's post-condition never leaves on the wire ------------
// The join two Wave 3 changes left untested: this function was widened to carry
// `validation` to the domain, and the producer in `content/actions/` was taught
// to keep a sensitive control's value out of it. The producer's redaction is in
// another package, so it cannot be what makes this one safe, and these rows
// hand this function exactly what a producer with its redaction removed would
// send. The sentinel is not a secret and carries no shape of one; it stands for
// whatever a leaking producer would have written, and every row searches the
// whole serialized payload for it rather than one named field, which is how
// every leak in this plan was found.

const producerSentinel = "SENTINEL-VALUE-A-PRODUCER-SHOULD-HAVE-WITHHELD";

// The marker's exact words, pinned once in the repository. Both exits share the
// constant, so nothing else needs to restate it -- but a marker nobody can grep
// for is a proof nobody can repeat, so one row spells it out.
assert.equal(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, "(withheld: the action ran on a control that holds a secret)");

/** A result whose target the shared rule marks, carrying a comparison the producer failed to redact. */
function leakingResult(attributes: Record<string, string>, inputType = "text"): WebAutomationActionResult {
  return {
    commandId: "command.sensitive",
    actionType: "web.dom.type",
    status: "succeeded",
    validation: { status: "passed", expected: `the field holds "${producerSentinel}"`, actual: `the field holds "${producerSentinel}"` },
    message: "Text entered.",
    url: "https://example.test/checkout",
    element: { tagName: "input", selector: "[data-testid=\"payment\"]", inputType, attributes } as never,
    startedAt: 100,
    finishedAt: 140
  };
}

// Each of the three signals the one rule reads, so a copy of the rule that
// dropped one of them would fail here rather than in `sensitivity/` alone. The
// multi-token spelling is the one that has leaked a card number twice in this
// plan.
const sensitiveSignals: Array<[what: string, attributes: Record<string, string>, inputType: string]> = [
  ["the effective control type", {}, "password"],
  ["the type attribute", { type: "password" }, "text"],
  ["a single-token autocomplete", { autocomplete: "cc-number" }, "text"],
  ["a multi-token autocomplete", { autocomplete: "billing cc-number" }, "text"],
  ["the data-sensitive marker", { "data-sensitive": "true" }, "text"]
];

for (const [what, attributes, inputType] of sensitiveSignals) {
  const payload = webAutomationActionResultPayload(leakingResult(attributes, inputType));
  assert.equal(
    JSON.stringify(payload).includes(producerSentinel),
    false,
    `${what}: nothing the producer failed to withhold reaches the wire payload`
  );
  assert.deepEqual(
    payload.validation,
    { status: "passed", expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT },
    `${what}: the status still says whether the post-condition held, the text is withheld, and no flag is stamped -- the flag is the producer's declaration, and this layer is not the producer`
  );
}

// A failed post-condition is the case that matters most -- it is the one that
// becomes a failure record Core shows an operator -- and it is withheld the
// same way, status and all.
const failedSensitive = webAutomationActionResultPayload({
  ...leakingResult({ autocomplete: "cc-number" }),
  status: "failed",
  validation: { status: "failed", expected: `the field holds "${producerSentinel}"`, actual: "the field holds something else" }
});
assert.equal(JSON.stringify(failedSensitive).includes(producerSentinel), false);
assert.deepEqual(failedSensitive.validation, { status: "failed", expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT });

// The other direction, which is the whole reason the rule is a rule and not a
// blanket: an ordinary control keeps a comparison an operator can act on.
const ordinary = webAutomationActionResultPayload({
  ...leakingResult({ autocomplete: "username" }),
  validation: { status: "passed", expected: "the field holds \"synthetic-control-text\"", actual: "the field holds \"synthetic-control-text\"" }
});
assert.deepEqual(ordinary.validation, { status: "passed", expected: "the field holds \"synthetic-control-text\"", actual: "the field holds \"synthetic-control-text\"" });

// A `none` validation has no comparison to withhold, and must not gain one.
assert.deepEqual(
  webAutomationActionResultPayload({ ...leakingResult({ autocomplete: "cc-number" }), validation: { status: "none", reason: "evidence-only" } }).validation,
  { status: "none", reason: "evidence-only" }
);

// The guard's reach, pinned so it is visible rather than assumed: it asks the
// descriptor the result carries, so a result with a text-bearing validation and
// no descriptor cannot be judged here and passes through. Every producer that
// redacts today sends one; a new verb that does not would land outside this
// guard, and that is what this row is for.
const undescribed = leakingResult({ autocomplete: "cc-number" });
delete undescribed.element;
assert.equal(
  JSON.stringify(webAutomationActionResultPayload(undescribed)).includes(producerSentinel),
  true,
  "with no element descriptor the wire payload is only as safe as the producer -- the limit is real, not a claim"
);

// -- The neighbour field, now carried, and the condition that lets it be ------
// `resolution` was dropped here until 2026-09-12, on the correct ground that
// nothing produced it on a successful action. The producer now exists --
// `content/action-runtime/resolve-target.ts` returns the measurement with the
// element and every verb passes it into its evidence -- so the field is carried,
// which is what D1 promised: strategy, candidate count, best and runner-up score
// and confidence in every action result, not only in the ones that failed.
//
// The condition the previous row stated for adding it was that the shape must
// not have grown a string, and it has not. `WebAutomationTargetResolution` is a
// closed six-value `strategy` enum plus four numbers, so unlike `validation` it
// carries nothing derived from the page and needs no redaction guard. The two
// assertions below are that condition, pinned rather than asserted once: the
// first that the measurement arrives whole, the second that the only string in
// it is the strategy. The candidate *labels* a TARGET_AMBIGUOUS failure names
// are page text, and they still ride on the failure record, not here.
const measured = { strategy: "scored-candidate", candidateCount: 3, bestScore: 0.51, runnerUpScore: 0.28, confidence: 0.51 } as const;
const carried = webAutomationActionResultPayload({ ...failedValidationResult, resolution: measured });
assert.deepEqual(carried.resolution, measured, "the result mapping carries the resolution measurement");

const resolutionStrings = Object.entries(measured).filter(([, value]) => typeof value === "string").map(([key]) => key);
assert.deepEqual(
  resolutionStrings,
  ["strategy"],
  "resolution stays free of page text -- a new string field here needs a redaction guard before it is carried"
);

// A success carries it too, which is the whole point of the change: the shape
// below is what an exact Level 1 match reports, and a Flow can tell it from the
// scored one above by the scores it does not have.
assert.deepEqual(
  webAutomationActionResultPayload({
    ...failedValidationResult,
    status: "succeeded",
    validation: { status: "passed", expected: "the click lands on the target", actual: "it did" },
    resolution: { strategy: "selector", candidateCount: 1 }
  }).resolution,
  { strategy: "selector", candidateCount: 1 }
);

// And a result that resolved nothing -- a scroll to a position, a keypress with
// no named target -- gains no empty measurement.
assert.equal("resolution" in webAutomationActionResultPayload(failedValidationResult), false);

// -- A value the run never supplied is refused, never typed as nothing --------
// A sensitive control's node asks for its value under a path. Core answers the
// request from the run's inputs before dispatch; a command that still carries
// one was never answered, and reading it as absent text would type an empty
// string and report success. The refusal names parameters and paths only.

const unsuppliedFailure = {
  category: "user_intervention_required",
  code: "web.intervention.required",
  retryable: false,
  stage: "execution",
  expected: "values supplied at run time for web.secret.password",
  actual: "the run supplied none, so the action was not dispatched"
};
const unsupplied = webAutomationActionFromGatewayCommand({
  commandId: "command.unsupplied",
  actionType: "web.dom.type",
  target: { selector: "#password" },
  parameters: { selector: "#password", text: { $state: { path: "web.secret.password" } } }
});
assert.deepEqual(unsupplied, {
  commandId: "command.unsupplied",
  status: "rejected",
  actionType: "web.dom.type",
  message: "Not dispatched: these parameters need values supplied at run time that this run did not supply: text (web.secret.password)",
  failure: unsuppliedFailure
});
assert.equal("text" in unsupplied, false, "a refused command carries nothing to type");
assert.deepEqual(parseAutomationStudioFailureRecord("failure" in unsupplied ? unsupplied.failure : undefined), unsuppliedFailure, "Core's parser keeps the record whole");

// Answered, the request is gone -- Core replaced it with the run input -- and the
// command dispatches as ordinary text.
const answeredSentinel = "run-supplied-sentinel";
const answered = webAutomationActionFromGatewayCommand({
  commandId: "command.answered",
  actionType: "web.dom.type",
  target: { selector: "#password" },
  parameters: { selector: "#password", text: answeredSentinel }
});
assert.equal("status" in answered, false, "an answered request is not refused");
assert.equal((answered as { text?: string }).text, answeredSentinel);

// Several unmet requests are all named, each with its path, and a literal
// beside them is neither named nor echoed.
const several = webAutomationActionFromGatewayCommand({
  commandId: "command.several",
  actionType: "web.dom.type",
  parameters: { text: { $state: { path: "web.secret.password" } }, value: { $state: { path: "web.secret.card-number" } }, key: answeredSentinel }
});
assert.equal("message" in several ? several.message : undefined, "Not dispatched: these parameters need values supplied at run time that this run did not supply: text (web.secret.password), value (web.secret.card-number)");
assert.equal(JSON.stringify(several).includes(answeredSentinel), false, "the refusal carries names and paths, never a parameter value");

// The guard's reach: a binding on another namespace is not a secret request.
assert.equal("status" in webAutomationActionFromGatewayCommand({ commandId: "command.other", actionType: "web.dom.type", parameters: { text: { $state: { path: "web.elements.password" } } } }), false);
// An unknown action type is still refused as unknown first.
assert.equal(
  (webAutomationActionFromGatewayCommand({ commandId: "command.unknown", actionType: "web.dom.hover", parameters: { text: { $state: { path: "web.secret.password" } } } }) as { failure?: { code?: string } }).failure?.code,
  "web.action.unsupported_type"
);

// -- A required field that cannot be read is refused, never half-dispatched ---
// `web.dom.assert` requires `assert`. One the parameter reader refused would
// otherwise reach the verb as an action with nothing it can check. It is refused
// before dispatch instead, as a node authored wrong: category
// `graph_validation_or_unknown_node`, which Core answers with a structural fix
// rather than a retry. The text names the action and the field, never what was
// sent in it.

const unreadableSentinel = "SENTINEL-INSIDE-AN-UNREADABLE-PARAMETER";
const invalidParameterFailure = {
  category: "graph_validation_or_unknown_node",
  code: "web.action.invalid_parameter",
  retryable: false,
  stage: "dispatch",
  expected: "web.dom.assert with a well-formed assert",
  actual: "assert could not be read, so the action was not dispatched"
};
const unreadable = webAutomationActionFromGatewayCommand({
  commandId: "command.unreadable",
  actionType: "web.dom.assert",
  target: { selector: "#banner" },
  parameters: { selector: "#banner", assert: { kind: "contains", expected: unreadableSentinel } }
});
assert.deepEqual(unreadable, {
  commandId: "command.unreadable",
  status: "rejected",
  actionType: "web.dom.assert",
  message: "Not dispatched: web.dom.assert requires assert, and what was sent could not be read.",
  failure: invalidParameterFailure
});
assert.deepEqual(parseAutomationStudioFailureRecord("failure" in unreadable ? unreadable.failure : undefined), invalidParameterFailure, "Core's parser keeps the record whole");
assert.equal(JSON.stringify(unreadable).includes(unreadableSentinel), false, "the refusal names the action and the field, never what was sent in it");

// The same refusal on an optional field only leaves that field unapplied.
assert.equal(
  "status" in webAutomationActionFromGatewayCommand({ commandId: "command.optional", actionType: "web.dom.scroll", parameters: { scroll: { mode: "down" } } }),
  false,
  "an optional field the reader refused does not refuse the command"
);
// The checks run in a fixed order: an unmet secret request is reported before an unreadable field.
assert.equal(
  (webAutomationActionFromGatewayCommand({ commandId: "command.both", actionType: "web.dom.assert", parameters: { assert: { kind: "contains" }, text: { $state: { path: "web.secret.password" } } } }) as { failure?: { code?: string } }).failure?.code,
  "web.intervention.required"
);

console.log("Web automation gateway mapping tests passed.");
