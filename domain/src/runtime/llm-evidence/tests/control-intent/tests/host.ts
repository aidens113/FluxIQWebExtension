import assert from "node:assert/strict";
import {
  AutomationStudioFlowCandidateSubmissionController,
  AutomationStudioNativeNodeRuntime,
  automationStudioFlowBootstrapActionPermissions
} from "fluxiq/automation-studio";
import {
  createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS
} from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime } from "../../../tools";

/** Actual public Core, web binding and permission gate; only the capture gateway is a unit stub. */
export async function controlIntentCandidateHost(words: string, consent: boolean) {
  const scope = { projectId: "project.intent", flowId: "flow.intent" };
  let captures = 0;
  let actions = 0;
  const binding = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.intent"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") {
        actions += 1;
        assert.fail("candidate authoring must not dispatch a main action");
      }
      captures += 1;
      return { status: "succeeded", payload: { sourceId: "tab:4:frame:0", snapshot: {
        url: "https://workspace.test/replies", title: "Workspace", frame: { isTop: true },
        viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0 },
        interactiveElements: [
          { tagName: "div", selector: "#notice", role: "dialog" },
          { tagName: "button", selector: "#answer", accessibleName: words, parent: 0 }
        ],
        evidence: {
          dialogs: { open: [{ selector: "#notice", modal: false, kind: consent ? "consent" : "promotion" }] },
          loading: { documentState: "complete", busy: false, pendingNavigation: false },
          navigation: { timeOrigin: 123 }
        }
      } } };
    }
  });
  const captured = await binding.executeTool({ ...scope, callId: "observed", toolId: "core.run_node",
    value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  assert.equal(captured.resultCode, "web.inspect.succeeded");
  const permissions = automationStudioFlowBootstrapActionPermissions({
    permittedConsequences: [], instructionIds: [],
    executeTool: (call) => binding.executeTool({ ...scope, ...call })
  });
  const native = new AutomationStudioNativeNodeRuntime({
    runtimeCapabilities: [...WEB_AUTOMATION_RUNTIME_CAPABILITIES],
    permissions: [...WEB_AUTOMATION_RUNTIME_PERMISSIONS]
  }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  const controller = new AutomationStudioFlowCandidateSubmissionController({
    ...scope, registry: native.sdk.nodes,
    resolution: native.getRegistryResolution({ kind: "domain", domainId: "web-automation" }),
    binding, permissionFor: permissions.planStep, baseDependencyDigest: "observed.control.intent"
  });
  return { controller, permissions, counts: () => ({ captures, actions }) };
}
