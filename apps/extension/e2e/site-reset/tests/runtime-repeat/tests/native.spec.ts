// Real installed browser/native runtime proof. No model, replacement dispatch,
// fabricated receipt, or fabricated host observation participates in either run.
import type { AutomationStudioFlowDocument, AutomationStudioFlowEdge, AutomationStudioFlowNode } from "fluxiq/automation-studio";
import {
  createWebAutomationHostRuntime,
  WEB_AUTOMATION_DOMAIN_ID
} from "@fluxiq-web-extension/domain";
import { dispatchWebAutomationOutput } from "../../../../../../../domain/src/io/gateway-output-dispatcher";
import { expect, test } from "../../../../fixtures/extension-context";
import { startInstalledBuild } from "../../../index";

const edge = (sourceNodeId: string, targetNodeId: string, sourcePortId = "success", targetPortId = "in"): AutomationStudioFlowEdge => ({
  id: `${sourceNodeId}.${sourcePortId}.${targetNodeId}.${targetPortId}`, sourceNodeId, sourcePortId, targetNodeId, targetPortId
});

/** Required receipts admit the canonical policy action, whose registered web
 * output reaches the real browser. Direct importer executors are deliberately
 * refused in required mode because arbitrary code is not a receipt boundary.
 */
const read: AutomationStudioFlowNode = {
  id: "read", definitionId: "builtin.policy.action",
  parameterValues: { outputId: "web.dom.capture_snapshot", parameters: {} }
};

function flow(flowId: string, finite: boolean): AutomationStudioFlowDocument {
  const first: AutomationStudioFlowNode = {
    id: "constant", definitionId: "builtin.data.constant",
    // Duplicate-looking items deliberately leave the browser read unchanged.
    parameterValues: { value: finite ? Array.from({ length: 7 }, () => "same") : true }
  };
  const control: AutomationStudioFlowNode = finite
    ? { id: "control", definitionId: "builtin.control.for-each", parameterValues: { maxIterations: 7 } }
    : { id: "control", definitionId: "builtin.control.branch" };
  return {
    schemaVersion: "0.1", flowId, ownerKind: "routine", ownerId: "routine.repeat.fixture",
    name: finite ? "Seven unchanged reads" : "Unchanged read cycle", createdAt: 1, updatedAt: 1,
    nodes: [first, ...(finite ? [control, read] : [read, control]), { id: "end", definitionId: "builtin.control.end" }],
    edges: finite ? [
      edge("constant", "control"), edge("constant", "control", "value", "items"),
      edge("control", "read", "body"), edge("read", "control"), edge("control", "end", "done")
    ] : [
      edge("constant", "read"), edge("constant", "control", "value", "condition"),
      edge("read", "control"), edge("control", "read", "true"), edge("control", "end", "false")
    ]
  };
}

for (const finite of [false, true]) {
  test(`installed native unchanged read ${finite ? "finishes seven real For Each passes" : "refuses its third dispatch through a canonical Branch"}`, async ({ extensionSession }) => {
    test.setTimeout(180_000);
    // This harness disables environment loading and model providers, installs the
    // genuine native registry and uses an isolated Lab, profile and Core root.
    const installed = await startInstalledBuild(extensionSession);
    const { page, fluxiq, service } = installed;
    let hostCommands = 0;
    let hostCaptures = 0;
    const host = createWebAutomationHostRuntime({ dispatch: async (request) => {
      hostCommands++;
      if (request.outputId === "web.dom.capture_snapshot" && request.metadata?.source === "web-automation-host-runtime") hostCaptures++;
      return dispatchWebAutomationOutput(fluxiq, { domainId: WEB_AUTOMATION_DOMAIN_ID, ...request });
    } }, () => fluxiq.programs.clientGateway.snapshot().sessions);
    const observe = host.observeRuntimeRepeat;
    // Missing producer/SDK is a failed prerequisite, never substitute equality.
    if (observe === undefined) {
      await installed.close();
      throw new Error("runtime-repeat proof requires the real host observer and rebuilt Core SDK.");
    }
    const observations = { observed: 0, unavailable: 0, before: 0, after: 0, addedCommands: 0 };
    const reasons = { missing: 0, partial: 0, unreadable: 0, unsupported: 0 };
    // Equality stays private in the real host/Core. Diagnostics retain only
    // closed labels and counts; return the real answer object unchanged.
    host.observeRuntimeRepeat = async (input) => {
      const siteBefore = installed.siteCommands().length;
      const hostBefore = hostCommands;
      const answer = await observe.call(host, input);
      observations.addedCommands += installed.siteCommands().length - siteBefore + hostCommands - hostBefore;
      if (input.point === "before_action") observations.before++;
      else observations.after++;
      if (answer.kind === "observed") observations.observed++;
      else {
        observations.unavailable++;
        reasons[answer.reason]++;
      }
      return answer;
    };
    try {
      await page.goto(new URL("/scenarios/company-website/", installed.origin).href);
      // Let the site's real timed overlays settle and dismiss them using their
      // own controls before measuring a stable, read-only runtime.
      await page.locator('div[title="Close"]').click();
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Newsletter", exact: true })).toBeVisible({ timeout: 15_000 });
      await page.getByText("No thanks, I will pay full price", { exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Newsletter", exact: true })).toHaveCount(0);
      // The fixture manifest's home-has-no-frames fact matches the producer's
      // deliberately narrow supported top-document observation scope.
      await expect(page.locator("iframe, frame")).toHaveCount(0);
      await installed.pair();
      service.bindHostRuntime(host);
      const project = await service.createProject({ name: "Installed native repeat proof", domainId: WEB_AUTOMATION_DOMAIN_ID });
      const created = await service.createFlow({ projectId: project.id, flowId: finite ? "flow.repeat.finite" : "flow.repeat.unchanged", name: "Native read proof" });
      await service.saveFlowGenerationInstruction({
        projectId: project.id, flowId: created.flowId,
        instruction: finite ? "Read the current page seven times without changing it." : "Read the current page repeatedly while the fixed condition is true, without changing it."
      });
      const beforeMarkup = await page.locator("body").innerHTML();
      const siteStart = installed.siteCommands().length;
      const resultStart = installed.actionResultSummaries().length;
      const result = await service.runRuntimeSession({
        projectId: project.id, flow: flow(created.flowId, finite),
        commandOutcomeMode: "required", adaptiveMode: "no_llm_intervention",
        permittedConsequences: [], authorizedExternalSideEffects: false
      });
      const trace = result.trace;
      if (trace === undefined) throw new Error("The real runtime returned no trace.");
      const attempts = trace.attempts.filter((attempt) => attempt.nodeId === "read");
      const successful = attempts.filter((attempt) => attempt.status === "succeeded");
      const expectedReads = finite ? 7 : 2;
      expect(result.status).toBe(finite ? "succeeded" : "failed");
      expect(successful).toHaveLength(expectedReads);
      expect(attempts).toHaveLength(finite ? 7 : 3);
      expect(trace.attempts.every((attempt) => attempt.repair === undefined || attempt.repair.outcome === "none")).toBe(true);
      expect(trace.repairs ?? []).toHaveLength(0);
      if (!finite) {
        expect(trace.failure?.code).toBe("executor.runtime.unchanged_repeat");
        const refused = attempts[2]!;
        expect(refused.status).toBe("failed");
        expect(refused.failure).toMatchObject({ code: "executor.runtime.unchanged_repeat", retryable: false, stage: "dispatch", effect: "unacted" });
        expect(refused.effects).toEqual([]);
        expect(refused.outputs).toEqual({});
        expect(trace.attempts.filter((attempt) => attempt.nodeId === "control")).toHaveLength(2);
      } else {
        expect(trace.failure).toBeUndefined();
        const passes = trace.attempts.filter((attempt) => attempt.nodeId === "control");
        expect(passes).toHaveLength(8);
        expect(passes.every((attempt) => attempt.status === "succeeded")).toBe(true);
        expect(passes.slice(0, 7).map((attempt) => attempt.outputs.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(trace.attempts.filter((attempt) => attempt.nodeId === "end" && attempt.status === "succeeded")).toHaveLength(1);
      }
      // Distinct real captures are evidence of volatile capture metadata. Never
      // publish IDs or read page content as a substitute for host equality.
      const refs = successful.map((attempt) => attempt.stateRefs?.afterAction?.stateRef);
      expect(refs.every((ref) => typeof ref === "string")).toBe(true);
      expect(new Set(refs).size).toBe(expectedReads);
      const sent = installed.siteCommands().slice(siteStart);
      const received = installed.actionResultSummaries().slice(resultStart);
      expect(sent.every((type) => type === "web.dom.capture_snapshot")).toBe(true);
      expect(hostCommands).toBe(hostCaptures);
      // Host captures are distinct from the two/seven actual native A acts.
      expect(sent.length - hostCaptures).toBe(expectedReads);
      expect(received).toHaveLength(sent.length);
      expect(received.every((entry) => entry.status === "succeeded")).toBe(true);
      // The existing private command map supplies only cardinality: every
      // actual gateway command has a fresh ID, without exposing any ID.
      expect(installed.distinctActionCommands()).toBe(installed.siteCommands().length);
      expect(observations.observed).toBeGreaterThanOrEqual(expectedReads * 2);
      expect(observations.unavailable).toBe(0);
      expect(observations.addedCommands).toBe(0);
      expect(await page.locator("body").innerHTML() === beforeMarkup).toBe(true);
      expect(installed.gatewayErrors).toHaveLength(0);
      console.log(JSON.stringify({ runtimeRepeatProof: finite ? "finite" : "unchanged", status: result.status, nativeSuccesses: successful.length, nativeAttempts: attempts.length, hostCaptures, siteCommands: sent.length, observations, reasons }));
    } finally {
      await installed.close();
    }
  });
}
