import assert from "node:assert/strict";
import test from "node:test";
import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../constants";
import { createWebElementMatcher } from "../../../element-fingerprint";
import { normalizeWebRecordingCandidateParameters, prepareWebRecordingEntryTarget, webRecordingTargetPolicy } from "../../../target-normalization";
import { createWebAutomationOutputNodeImplementationBundle, createWebAutomationOutputNodeManifest } from "../../native-runtime";

const input = { action: { actionType: "web.dom.click", outputId: "web.dom.click", parameters: { target: { kind: "element", fingerprint: { selector: "#saved" }, candidates: [{ candidateId: "saved", selector: "#saved" }] } } }, domainId: "web", output: { id: "web.dom.click", title: "Click", metadata: { elementTarget: true } } };

test("the default bundle registers the web readings of targets under its own domain", () => {
  const bundle = createWebAutomationOutputNodeImplementationBundle();
  assert.equal(bundle.recordingEntryTargetPreparer, prepareWebRecordingEntryTarget);
  assert.equal(bundle.recordingCandidateParameterNormalizer, normalizeWebRecordingCandidateParameters);
  assert.equal(bundle.recordingTargetPolicy, webRecordingTargetPolicy);
  const hooks = new AutomationStudioNativeNodeRuntime().register(createWebAutomationOutputNodeManifest(), bundle).getTargetHooks(WEB_AUTOMATION_DOMAIN_ID);
  assert.equal(hooks?.outputTargetPreparer, bundle.outputTargetPreparer);
  assert.equal(hooks?.recordingEntryTargetPreparer, prepareWebRecordingEntryTarget);
  assert.equal(hooks?.recordingCandidateParameterNormalizer, normalizeWebRecordingCandidateParameters);
  assert.equal(hooks?.recordingTargetPolicy, webRecordingTargetPolicy);
});

test("a host's own hooks and matcher replace the defaults", () => {
  const outputTargetPreparer = () => ({ ok: true as const });
  const recordingEntryTargetPreparer = () => null;
  const custom = createWebAutomationOutputNodeImplementationBundle({ outputTargetPreparer, recordingEntryTargetPreparer });
  assert.equal(custom.outputTargetPreparer, outputTargetPreparer);
  assert.equal(custom.recordingEntryTargetPreparer, recordingEntryTargetPreparer);
  const matcher = createWebElementMatcher();
  const customMatcher = createWebAutomationOutputNodeImplementationBundle({ elementMatcher: matcher });
  assert.equal(customMatcher.elementMatcher, matcher);
  const result = customMatcher.outputTargetPreparer!(input);
  assert.ok(result.ok);
  assert.equal(result.resolution?.status, "matched");
});

test("an explicitly missing hook stays missing rather than silently restoring a default", () => {
  const hookOverride = {};
  Object.defineProperty(hookOverride, "outputTargetPreparer", { value: undefined, enumerable: true });
  assert.equal(createWebAutomationOutputNodeImplementationBundle(hookOverride).outputTargetPreparer, undefined);
  const matcherOverride = {};
  Object.defineProperty(matcherOverride, "elementMatcher", { value: undefined, enumerable: true });
  const result = createWebAutomationOutputNodeImplementationBundle(matcherOverride).outputTargetPreparer!(input);
  assert.ok(result.ok);
  assert.equal(result.resolution?.status, "unresolved_no_matcher");
});
