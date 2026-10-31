import assert from "node:assert/strict";
import {
  AutomationStudioNativeNodeRuntime,
  automationStudioFlowBootstrapActionPermissions,
  automationStudioLlmRerunCapture,
  automationStudioLlmRerunExecution,
  type AutomationStudioLlmEvidenceLoopInput
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationOutputNodeManifest,
  createWebAutomationOutputNodeImplementationBundle,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS
} from "../../../../../output-nodes";
import { createWebLlmTargetPackets } from "../../../plan-resolution";
import { createWebLlmExtractionHandles } from "../../../structure";
import type { WebLlmEvidenceGateway, WebLlmEvidenceToolRequest } from "../../../capture";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import {
  createWebNodeArrivals, createWebNodeHeldLiterals, createWebNodeOwnLayers,
  createWebNodeShownAddresses, runWebOutputNode
} from "../..";
import { createWebNodeFrozenExecution, webNodeFinalGateway } from "..";
import { FLOW, PAGE, SNAPSHOT, TYPE, field } from "./harness";

/** Real Core gate/registry and real web capsule path; gateway alone is a unit stub. */
export function pairedHost() {
  let controls = [field("A", "#original")];
  let timeOrigin = 123;
  let stores = { targets: createWebLlmTargetPackets(), extractions: createWebLlmExtractionHandles() };
  const main: JsonObject[] = [];
  const captureLabels: string[] = [];
  const publishLabels: string[] = [];
  const executionLabels: string[] = [];
  const gateway: WebLlmEvidenceGateway = webNodeFinalGateway({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { sourceId: "tab:4:frame:0", snapshot: {
          url: PAGE, title: "Workspace", frame: { isTop: true },
          viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0 },
          interactiveElements: controls,
          evidence: {
            captureOptions: { includeHidden: command.parameters.includeHidden === true },
            elements: { scanned: controls.length, candidates: controls.length, matched: controls.length, returned: controls.length, truncated: false },
            loading: { documentState: "complete", busy: false, pendingNavigation: false },
            navigation: { timeOrigin }
          }
        } } };
      }
      assert.equal(command.actionType, "web.dom.type", "no reset, navigation or hidden alternative act");
      main.push(structuredClone(command.parameters));
      return { status: "succeeded", payload: { value: "Fixed value" } };
    }
  });
  const frozenExecution = createWebNodeFrozenExecution({
    capture() {
      const access = automationStudioLlmRerunCapture();
      captureLabels.push(access.kind === "capture" ? "capture" : access.reason);
      if (access.kind !== "capture") return access;
      return { kind: "capture", publish(snapshot) {
        const outcome = access.publish(snapshot);
        publishLabels.push(outcome.kind === "accepted" ? "accepted" : outcome.reason);
        return outcome;
      } };
    },
    execution(input) {
      const access = automationStudioLlmRerunExecution(input);
      executionLabels.push(access.kind === "refused" ? access.reason : access.kind);
      return access;
    }
  });
  const remember = (page: WebLlmSnapshotBinding) => stores.targets.remember(FLOW, page);
  const base = {
    gateway, sessionId: "session.one", frozenExecution,
    restamp: (page: WebLlmSnapshotBinding) => page,
    shown: remember, looked: (page: WebLlmSnapshotBinding) => stores.targets.rememberLook(FLOW, page),
    arrivals: createWebNodeArrivals(), addresses: createWebNodeShownAddresses(),
    layers: createWebNodeOwnLayers(), held: createWebNodeHeldLiterals()
  };
  const execute = (request: WebLlmEvidenceToolRequest) => runWebOutputNode({ ...base, stores, request });
  const permissions = automationStudioFlowBootstrapActionPermissions({
    permittedConsequences: [], instructionIds: [],
    executeTool: (call) => execute({ ...FLOW, ...call })
  });
  const native = new AutomationStudioNativeNodeRuntime({
    runtimeCapabilities: [...WEB_AUTOMATION_RUNTIME_CAPABILITIES],
    permissions: [...WEB_AUTOMATION_RUNTIME_PERMISSIONS]
  }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  const scope = { kind: "domain" as const, domainId: "web-automation" };
  const generation = {};
  const authority: NonNullable<AutomationStudioLlmEvidenceLoopInput["rerunAuthority"]> = {
    currentScope: () => ({ binding: frozenExecution, generation, registry: native, authority: permissions }),
    resolve: (id, parameters, effectiveInputs) => {
      if (Object.keys(effectiveInputs).length !== 0) return undefined;
      const definition = native.sdk.nodes.get(id, native.getRegistryResolution(scope));
      if (!definition?.capabilities.executable) return undefined;
      const effect = native.resolveActionEffect({
        id: "paired-proof", definitionId: definition.id, definitionVersion: definition.version, parameterValues: parameters
      }, parameters);
      return effect ? { definitionId: definition.id, definitionVersion: definition.version, effect } : undefined;
    }
  };
  return {
    authority, main,
    diagnostics: () => ({
      main: main.length, captureLabels, publishLabels, executionLabels,
      assessments: permissions.declarations().map((record) => ({
        kind: record.action.kind, effect: record.action.effect,
        consequences: record.consequences.length, permitted: record.permitted
      }))
    }),
    tools: [{
      toolId: "core.run_node", description: "Run the registered web node.",
      effect: "mutate" as const, perCallEffect: true as const, actionInputKey: "node",
      inputSchema: { type: "object", properties: { node: { enum: [TYPE] }, parameters: { type: "object" }, consequences: { type: "array" } } }
    }],
    executeTool: permissions.executeTool,
    async prime() {
      const result = await execute({ ...FLOW, callId: "initial-view", toolId: "core.run_node", value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
      assert.equal(result.resultCode, "web.inspect.succeeded");
    },
    async replaceMap() {
      stores = { targets: createWebLlmTargetPackets(), extractions: createWebLlmExtractionHandles() };
      controls = [field("B", "#other"), field("A", "#refreshed")];
      await this.prime();
      const oldHandle = stores.targets.resolve(FLOW, "t1", PAGE);
      assert.equal(oldHandle.ok, true);
      if (oldHandle.ok) assert.equal(oldHandle.selector, "#other");
    },
    changeDocument() { timeOrigin += 1; }
  };
}
