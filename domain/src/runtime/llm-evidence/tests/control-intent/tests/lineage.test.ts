import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationStudioNativeNodeRuntime, checkAutomationStudioFlowBootstrapPlanCompletion,
  type AutomationStudioFlowDraftStep
} from "fluxiq/automation";
import {
  createWebAutomationOutputNodeManifest, createWebAutomationOutputNodeImplementationBundle,
  outputTargetFromPayload, WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS
} from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime } from "../../../tools";

/** The real web binding records acts; only its capture/action transport is a unit stub. */
function lineageHost(options: { consentOnFirstPage?: boolean } = {}) {
  const scope = { projectId: "project.lineage", flowId: "flow.lineage" };
  let location = "https://workspace.test/home";
  let document = 1;
  let actions = 0;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.lineage"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        const consent = options.consentOnFirstPage === true;
        const firstPage = document === 1;
        const linkName = consent ? "Accept all" : "Open workspace";
        const link: Record<string, string | number | Record<string, string>> = {
          tagName: "a", selector: "#workspace-open", accessibleName: linkName, href: "https://workspace.test/library", context: { landmark: "navigation" }
        };
        if (consent && firstPage) link.parent = 0;
        const openDialogs = consent && firstPage ? [{ selector: "#notice", modal: false, kind: "consent" }] : [];
        const fillers = () => !consent ? [] : [firstPage ? { tagName: "div", role: "dialog", selector: "#notice" } : { tagName: "div", selector: "#filler" }];
        return {
        status: "succeeded", payload: { sourceId: "tab:4:frame:0", snapshot: {
          url: location, title: "Workspace", frame: { isTop: true },
          viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0 },
          interactiveElements: [
            ...fillers(),
            link,
            { tagName: "a", selector: "#footer-open", accessibleName: "Open workspace", href: "https://workspace.test/help", context: { landmark: "contentinfo" } }
          ],
          evidence: { navigation: { timeOrigin: document }, dialogs: { open: openDialogs }, loading: { documentState: "complete", busy: false, pendingNavigation: false } }
        } }
        };
      }
      assert.equal(command.actionType, "web.dom.click");
      assert.equal(command.parameters.selector, "#workspace-open", "the duplicated label must not select the footer control");
      actions += 1;
      location = `https://workspace.test/library?visit=${actions}`;
      document += 1;
      return { status: "succeeded", payload: { sourceId: "tab:4:frame:0", actionType: "web.dom.click", status: "succeeded", url: location, validation: { status: "succeeded" } } };
    }
  });
  const native = new AutomationStudioNativeNodeRuntime({
    runtimeCapabilities: [...WEB_AUTOMATION_RUNTIME_CAPABILITIES], permissions: [...WEB_AUTOMATION_RUNTIME_PERMISSIONS]
  }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  const capture = () => runtime.executeTool({ ...scope, callId: "call.lineage.observe", toolId: "core.run_node", value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const act = (handle: string) => runtime.executeTool({
    ...scope, callId: `call.lineage.act.${actions}`, toolId: "core.run_node",
    value: { node: "web.output.dom-click", parameters: { target: { handle } }, consequences: [] }, permission: async () => ({ permitted: true })
  });
  const complete = (step: AutomationStudioFlowDraftStep) => checkAutomationStudioFlowBootstrapPlanCompletion({
    ...scope, origin: "model", result: { summary: "Open the workspace" }, draftSteps: [step], registry: native.sdk.nodes,
    resolution: native.getRegistryResolution({ kind: "domain", domainId: "web-automation" }), binding: runtime,
    permissionFor: () => async () => ({ permitted: true }), handleReach: "view_history"
  });
  return { runtime, native, scope, capture, act, complete, actions: () => actions };
}

function keptStep(executed: Awaited<ReturnType<ReturnType<typeof lineageHost>["act"]>>): AutomationStudioFlowDraftStep {
  const draft = executed.draft;
  assert.ok(draft);
  assert.ok(typeof draft.actionId === "string");
  assert.ok(draft.input);
  assert.ok(draft.ranWith);
  assert.ok(draft.effect === "observe" || draft.effect === "mutate");
  assert.ok(typeof executed.resultCode === "string");
  return {
    position: 1, iteration: 1, actionId: draft.actionId, toolId: "core.run_node",
    input: draft.input, ranWith: draft.ranWith, effect: draft.effect, proposes: true, disposition: "kept", resultCode: executed.resultCode
  };
}

test("public completion recovers one actual pre-act source and the Native executable preserves its whole fingerprint", async () => {
  const host = lineageHost();
  assert.equal((await host.capture()).resultCode, "web.inspect.succeeded");
  const acted = await host.act("t1");
  assert.equal(acted.resultCode, "web.action.succeeded");
  const step = keptStep(acted);
  const completed = await host.complete(step);
  assert.equal(completed.ok, true, JSON.stringify(completed));
  if (!completed.ok) return;
  const node = completed.buildPlan.plan.subflows[0]?.nodes[0];
  assert.ok(node);
  assert.equal(node.definitionId, "web.output.dom-click");
  assert.ok(step.ranWith);
  const original = step.ranWith.parameters;
  assert.ok(original !== null && typeof original === "object" && !Array.isArray(original));
  const parameters = node.parameters;
  assert.ok(parameters);
  assert.deepEqual(parameters.element, original.element);
  assert.equal(JSON.stringify(completed.buildPlan).includes("controlIntent"), false);
  assert.equal(JSON.stringify(completed.buildPlan).includes("responseOnly"), false);
  const executed = await host.native.execute({ id: "node.lineage", definitionId: node.definitionId, definitionVersion: node.definitionVersion, parameterValues: parameters }, {});
  assert.ok(executed);
  const effects = executed.result.effects?.filter(effect => effect.type === "policy.output.dispatch");
  assert.equal(effects?.length, 1);
  const payload = effects?.[0]?.payload;
  assert.ok(payload !== null && typeof payload === "object" && !Array.isArray(payload));
  assert.equal(payload.outputId, "web.dom.click");
  const dispatched = payload.parameters;
  assert.ok(dispatched !== null && typeof dispatched === "object" && !Array.isArray(dispatched));
  const target = outputTargetFromPayload(dispatched);
  assert.deepEqual(target?.element, original.element);
  assert.equal(target?.selector, original.selector);
  assert.equal(host.actions(), 1, "completion and Native effect creation dispatch no extra act");
});

test("two actual pre-act sources for the same absolute target resolve through public completion when their witnesses agree", async () => {
  const host = lineageHost();
  await host.capture();
  const first = await host.act("t1");
  const second = await host.act("t3");
  assert.equal(first.resultCode, "web.action.succeeded");
  assert.equal(second.resultCode, "web.action.succeeded");
  const completed = await host.complete(keptStep(first));
  assert.equal(completed.ok, true, JSON.stringify(completed));
  assert.equal(host.actions(), 2);
});

test("two actual pre-act sources for the same absolute target whose witnesses disagree remain ambiguous through public completion", async () => {
  const host = lineageHost({ consentOnFirstPage: true });
  await host.capture();
  const first = await host.act("t2");
  const second = await host.act("t5");
  assert.equal(first.resultCode, "web.action.succeeded");
  assert.equal(second.resultCode, "web.action.succeeded");
  const completed = await host.complete(keptStep(first));
  assert.equal(completed.ok, false, JSON.stringify(completed));
  if (!completed.ok) assert.ok(completed.issues.some(issue => issue.code === "web.handle.ambiguous"));
  assert.equal(host.actions(), 2);
});
