// Live-browser proof for recovery exploration state reduction.
//
// The model decisions are scripted so this test deterministically takes the
// path a real provider may choose; every observation and action still goes
// through the real content-script bundle against a real Chromium DOM. The
// sequence opens the wrong disclosure, closes it, then opens the right one.
// Core must recognize the reversal from the web domain's state digests and
// publish only the final, replayable press.

import type { JsonObject } from "fluxiq/core";
import {
  AutomationStudioLlmRunBudgetLedger,
  buildAutomationStudioRuntimeRecoveryContext,
  runAutomationStudioRecoveryExploration,
  startAutomationStudioRecoveryDeadline,
  type AutomationStudioAdaptationPolicy,
  type AutomationStudioFlowRunDetail,
  type AutomationStudioLlmProvider
} from "fluxiq/automation-studio";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_RECOVERY_PRESS_OPTION_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";

const PROJECT_ID = "project.live-state-digest";
const FLOW_ID = "flow.live-state-digest";
const RUN_ID = "run.live-state-digest";

test("recovery exploration reduces a live page change, reversal, and successful branch", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  await page.evaluate(() => {
    const host = document.createElement("section");
    host.innerHTML = `
      <button id="wrong-disclosure" type="button" aria-expanded="false">More filters</button>
      <div id="wrong-panel" hidden><button type="button">Wrong branch action</button></div>
      <button id="right-disclosure" type="button" aria-expanded="false">Advanced search</button>
      <div id="right-panel" hidden><button type="button">Desired recovery control</button></div>
    `;
    for (const id of ["wrong", "right"] as const) {
      const button = host.querySelector<HTMLButtonElement>(`#${id}-disclosure`)!;
      const panel = host.querySelector<HTMLElement>(`#${id}-panel`)!;
      button.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));
      });
    }
    document.querySelector("main")?.append(host);
  });

  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({
        commandId: `live-state-digest.${++command}`,
        actionType: request.actionType,
        ...request.parameters
      } as Parameters<typeof harness.runAction>[0]);
      const snapshot = reply.snapshot === undefined
        ? undefined
        : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return {
        status: reply.status,
        ...(snapshot ? { payload: { snapshot } } : {}),
        ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {})
      };
    }
  };
  const binding = createWebAutomationLlmEvidenceRuntime(gateway);
  const detail = failedRunDetail();
  const result = await runAutomationStudioRecoveryExploration({
    binding,
    scope: { kind: "domain", domainId: binding.domainId },
    policy: adaptationPolicy(),
    provider: disclosureProvider(),
    context: { projectId: PROJECT_ID, flowId: FLOW_ID, runId: RUN_ID },
    instructions: [],
    runDetail: detail,
    recoveryContext: buildAutomationStudioRuntimeRecoveryContext({ detail }),
    runBudget: new AutomationStudioLlmRunBudgetLedger({ maxCallsPerRun: 8, maxTotalTokensPerRun: 200_000, maxOutputTokensPerRun: 100_000 }),
    maxEstimatedCostUsd: 0.05,
    recoveryDeadline: startAutomationStudioRecoveryDeadline({ startedAtMs: Date.now() })
  });

  expect(result.exploration.outcome, JSON.stringify({
    reason: result.exploration.reason,
    endedBy: result.exploration.endedBy,
    trace: result.exploration.trace.map(({ iteration, decision, toolId, resultCode }) => ({ iteration, decision, toolId, resultCode }))
  })).toBe("evidence_gathered");
  expect(result.exploration.stateDigestFailures).toEqual([]);
  expect(result.exploration.steps).toHaveLength(4);
  const [inspect, openWrong, closeWrong, openRight] = result.exploration.steps;
  expect(inspect?.stateBefore).toBe(inspect?.stateAfter);
  expect(openWrong?.stateBefore).not.toBe(openWrong?.stateAfter);
  expect(closeWrong?.stateBefore).toBe(openWrong?.stateAfter);
  expect(closeWrong?.stateAfter).toBe(openWrong?.stateBefore);
  expect(openRight?.stateBefore).toBe(closeWrong?.stateAfter);
  expect(openRight?.stateAfter).not.toBe(openRight?.stateBefore);

  expect(result.reduced?.replayable, JSON.stringify({
    reason: result.reduced?.reason,
    reduction: result.reduced?.reduction
  })).toBe(true);
  expect(result.reduced?.reduction?.stateChainIntact).toBe(true);
  expect(result.reduced?.reduction?.actions).toEqual([
    expect.objectContaining({ actionId: WEB_RECOVERY_PRESS_OPTION_ID })
  ]);
  expect(result.reduced?.reduction?.dropped.map((step) => step.reason)).toEqual([
    "observation_only",
    "undone",
    "undone"
  ]);
  await expect(page.locator("#wrong-panel")).toBeHidden();
  await expect(page.locator("#right-panel")).toBeVisible();
});

/** Script only the provider choices; targets are read from live evidence. */
function disclosureProvider(): AutomationStudioLlmProvider {
  return {
    metadata: { provider: "scripted-live", model: "state-reduction" },
    runTask: async (request) => {
      const iteration = request.context.evidenceLoop?.iteration ?? 0;
      const evidence = request.context.evidenceLoop?.evidence ?? [];
      // The recovery bundle performs its declared inspect before provider turn
      // one, so the first decision can act on that evidence immediately.
      if (iteration === 1) return decision({ kind: "tool_call", callId: "call.open-wrong", toolId: WEB_RECOVERY_PRESS_OPTION_ID, input: { target: targetNamed(evidence, "More filters"), consequences: [] } });
      if (iteration === 2) return decision({ kind: "tool_call", callId: "call.close-wrong", toolId: WEB_RECOVERY_PRESS_OPTION_ID, input: { target: targetNamed(evidence, "More filters"), consequences: [] } });
      if (iteration === 3) return decision({ kind: "tool_call", callId: "call.open-right", toolId: WEB_RECOVERY_PRESS_OPTION_ID, input: { target: targetNamed(evidence, "Advanced search"), consequences: [] } });
      return decision({ kind: "complete", result: { findings: "The desired recovery control is visible." } });
    }
  };
}

function decision(value: JsonObject) {
  return { response: { kind: "evidence_tool_decision" as const, summary: "Inspecting the live page.", decision: value } };
}

function targetNamed(value: unknown, name: string): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = targetNamedOrUndefined(item, name);
      if (found) return found;
    }
  }
  throw new Error(`Live exploration evidence did not contain ${name}.`);
}

function targetNamedOrUndefined(value: unknown, name: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = targetNamedOrUndefined(item, name);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if ((record.name === name || record.text === name) && typeof record.target === "string") return record.target;
  for (const nested of Object.values(record)) {
    const found = targetNamedOrUndefined(nested, name);
    if (found) return found;
  }
  return undefined;
}

function adaptationPolicy(): AutomationStudioAdaptationPolicy {
  return {
    schemaVersion: "0.1",
    policyId: "policy.live-state-digest",
    scope: { kind: "flow", flowId: FLOW_ID },
    preset: "adaptive",
    proposalMode: "auto",
    allowRuntimeRecovery: true,
    allowCreateRecoveryPaths: true,
    allowModifySubflows: true,
    allowCreateSubflows: true,
    allowModifyRouter: true,
    allowModifyExpectations: true,
    allowModifyActionTargets: true,
    allowDeleteOrDisableBehavior: false,
    allowExternalSideEffects: true,
    requireApprovalForDestructiveChanges: true,
    requireApprovalForExternalSideEffects: false,
    createdAt: 1,
    updatedAt: 1
  };
}

function failedRunDetail(): AutomationStudioFlowRunDetail {
  return {
    schemaVersion: "0.1",
    summary: {
      schemaVersion: "0.1",
      runId: RUN_ID,
      flowId: FLOW_ID,
      projectId: PROJECT_ID,
      status: "failed",
      updatedAt: 1,
      routeDecisionCount: 0,
      subflowEntryCount: 0,
      actionAttemptCount: 0,
      interventionCount: 0,
      adaptationCount: 0
    },
    routeDecisions: [],
    subflows: [],
    interventions: [],
    adaptationIds: [],
    changeProposalIds: []
  };
}
