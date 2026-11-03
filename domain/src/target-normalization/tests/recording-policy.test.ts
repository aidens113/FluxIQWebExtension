import assert from "node:assert/strict";
import test from "node:test";
import { AutomationStudioNativeNodeRuntime, validateRecordingSession, type AutomationStudioElementTarget, type RecordingSession } from "fluxiq/automation";
import { createWebAutomationOutputNodeImplementationBundle, createWebAutomationOutputNodeManifest } from "../../output-nodes";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webRecordingTargetPolicy } from "../index";

function recording(entry: { target?: unknown; parameters?: Record<string, unknown> }): RecordingSession {
  return {
    schemaVersion: "0.1",
    recordingId: "recording.policy",
    startedAt: 1,
    environment: { id: "env", kind: "test", label: "Test", domainId: WEB_AUTOMATION_DOMAIN_ID },
    sources: [{ id: "source.host", kind: "event", label: "Host" }],
    actionChannels: [],
    initialState: { timestamp: 1, namespaces: {} },
    timeline: [{ id: "entry.1", recordingId: "recording.policy", timestamp: 2, monotonicOffsetMs: 1, sequence: 1, sourceId: "source.host", type: "action", actionType: "actual", parameters: entry.parameters ?? {}, ...(entry.target ? { target: entry.target } : {}), origin: "operator", startedAt: 2 }],
    notes: [],
    metadata: {}
  } as unknown as RecordingSession;
}

test("the policy keeps every target and parameter issue's code, message, path and raw confidence", () => {
  const elementTarget = { kind: "element" as const, fingerprint: { selector: "#saved", attributes: { authorization: "synthetic" } }, selectedCandidate: { candidateId: "saved", confidence: 1.2, matchedSignals: [], failedSignals: [] } } satisfies AutomationStudioElementTarget;
  const before = JSON.stringify(elementTarget);
  const expected = [
    { severity: "error", code: "element_target.sensitive_attribute", message: "Element target attributes cannot include sensitive keys.", path: "timeline.3.target.elementTarget.fingerprint.attributes" },
    { severity: "error", code: "element_target.selection_invalid_confidence", message: "Selected element confidence must be between 0 and 1.", path: "timeline.3.target.elementTarget.selectedCandidate.confidence" }
  ];
  assert.deepEqual(webRecordingTargetPolicy.targetIssues({ type: "ui_element", elementTarget }, "timeline.3.target"), expected);
  assert.deepEqual(webRecordingTargetPolicy.parameterIssues({ target: elementTarget }, "timeline.3.parameters"), expected.map((issue) => ({ ...issue, path: issue.path.replace("timeline.3.target.elementTarget", "timeline.3.parameters.target") })));
  assert.equal(JSON.stringify(elementTarget), before);
});

test("the policy reads only element targets, and a warning stays a warning", () => {
  assert.deepEqual(webRecordingTargetPolicy.targetIssues({ type: "client-target" }, "target"), []);
  assert.deepEqual(webRecordingTargetPolicy.parameterIssues({ target: { kind: "other" } }, "parameters"), []);
  assert.deepEqual(webRecordingTargetPolicy.parameterIssues({ target: "#saved" }, "parameters"), []);
  assert.deepEqual(webRecordingTargetPolicy.targetIssues({ type: "ui_element", elementTarget: { kind: "element", fingerprint: { id: "saved", selector: "" } } }, "target"), [
    { severity: "warning", code: "element_target.empty_signal", message: "Element target selector is empty and should be omitted.", path: "target.elementTarget.fingerprint.selector" }
  ]);
});

test("the registered policy is what makes Core's recording validation read a target, and Core alone reads none", () => {
  const invalid = recording({ target: { type: "ui_element", elementTarget: { kind: "element", fingerprint: { selector: "#save", bounds: { x: 0, y: 0, width: -1, height: 10 } } } }, parameters: { target: { kind: "element", fingerprint: {} } } });
  assert.deepEqual(validateRecordingSession(invalid).issues.filter((issue) => issue.code.startsWith("element_target.")), []);
  const runtime = new AutomationStudioNativeNodeRuntime().register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  const policy = runtime.getTargetHooks(WEB_AUTOMATION_DOMAIN_ID)?.recordingTargetPolicy;
  assert.equal(policy, webRecordingTargetPolicy);
  const issues = validateRecordingSession(invalid, policy).issues;
  assert.deepEqual(issues.filter((issue) => issue.code.startsWith("element_target.")).map((issue) => [issue.code, issue.path]), [
    ["element_target.invalid_bounds", "timeline.0.target.elementTarget.fingerprint.bounds"],
    ["element_target.empty_fingerprint", "timeline.0.parameters.target.fingerprint"]
  ]);
});
