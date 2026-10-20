// Live-browser proof for recovery exploration state reduction.
//
// The model decisions are scripted so this test deterministically takes the
// path a real provider may choose; every observation and action still goes
// through the real content-script bundle against a real Chromium DOM. The
// sequence opens the wrong disclosure, closes it, then opens the right one.
// Core must recognize the reversal from the web domain's state digests and
// publish only the final, replayable press.
//
// The disclosures are the local classifieds site's own folded filter panels on
// its results page (t730 moved the row off a synthetic page): "Date listed" is
// the wrong one and "Item condition" the right one, whose condition boxes are
// the control the recovery was looking for. Cookies and the notifications
// prompt are answered first through the site's `/api`, as a returning visitor
// has them, so no prompt lands between two digests.

import type { Page } from "@playwright/test";
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
import type { ContentHarness } from "../../../index.js";

const PROJECT_ID = "project.live-state-digest";
const FLOW_ID = "flow.live-state-digest";
const RUN_ID = "run.live-state-digest";

/** The two folded filter panels: the words on each toggle, and its line in the page view the model reads. */
const WRONG = { words: "Date listed", line: "Date listed ▾" };
const RIGHT = { words: "Item condition", line: "Item condition ▾" };

/** Sends one of the site's own state operations, as its page script does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

test("recovery exploration reduces a live page change, reversal, and successful branch", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("local-classifieds");
  await mutate(harness, "consent", { choice: "all" });
  await mutate(harness, "notifications", { choice: "not-now" });
  await page.goto(new URL("/scenarios/local-classifieds/search/?query=bike", harness.lab.origin).href);
  const wrong = page.locator("[role=button][aria-controls]", { hasText: WRONG.words });
  const right = page.locator("[role=button][aria-controls]", { hasText: RIGHT.words });
  const panelOf = async (toggle: typeof wrong) => page.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
  await loadWholeFeed(page);
  await expect(await panelOf(wrong)).toBeHidden();
  await expect(await panelOf(right)).toBeHidden();

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
  await expect(await panelOf(wrong)).toBeHidden();
  await expect(await panelOf(right)).toBeVisible();
  await expect((await panelOf(right)).getByRole("checkbox", { name: "New", exact: true })).toBeVisible();
});

/**
 * Scrolls the results feed to its end, as a person reading it would, so no
 * batch arrives between two digests when a press scrolls a toggle into view.
 * One batch per list fails once and offers "Try again", which is pressed.
 */
async function loadWholeFeed(page: Page): Promise<void> {
  const listings = page.locator("section[aria-label=\"Collection of Marketplace items\"] a[href]");
  await expect(listings.first()).toBeVisible();
  let unchanged = 0;
  let seen = -1;
  while (unchanged < 3) {
    const retry = page.locator("span", { hasText: /^Try again$/u });
    if (await retry.count()) await retry.first().click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(700);
    const count = await listings.count();
    unchanged = count === seen && !(await retry.count()) ? unchanged + 1 : 0;
    seen = count;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

/** Script only the provider choices; targets are read from live evidence. */
function disclosureProvider(): AutomationStudioLlmProvider {
  return {
    metadata: { provider: "scripted-live", model: "state-reduction" },
    runTask: async (request) => {
      const iteration = request.context.evidenceLoop?.iteration ?? 0;
      const evidence = request.context.evidenceLoop?.evidence ?? [];
      // The recovery bundle performs its declared inspect before provider turn
      // one, so the first decision can act on that evidence immediately.
      if (iteration === 1) return decision({ kind: "tool_call", callId: "call.open-wrong", toolId: WEB_RECOVERY_PRESS_OPTION_ID, input: { target: targetNamed(evidence, WRONG.line), consequences: [] } });
      if (iteration === 2) return decision({ kind: "tool_call", callId: "call.close-wrong", toolId: WEB_RECOVERY_PRESS_OPTION_ID, input: { target: targetNamed(evidence, WRONG.line), consequences: [] } });
      if (iteration === 3) return decision({ kind: "tool_call", callId: "call.open-right", toolId: WEB_RECOVERY_PRESS_OPTION_ID, input: { target: targetNamed(evidence, RIGHT.line), consequences: [] } });
      return decision({ kind: "complete", result: { findings: "The item condition boxes are visible." } });
    }
  };
}

function decision(value: JsonObject) {
  return { response: { kind: "evidence_tool_decision" as const, summary: "Inspecting the live page.", decision: value } };
}

/**
 * The handle the latest page view prints for a named control. The model reads
 * the page as lines such as `t62 button "Item condition ▾" closed`, and the
 * recovery options renumber every capture, so only the newest view counts.
 */
function targetNamed(value: unknown, name: string): string {
  const views: string[] = [];
  collectPageViews(value, views);
  const view = views.at(-1);
  const quoted = JSON.stringify(name).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const found = view?.match(new RegExp(`^(t\\d+) [a-z][^"\\n]* ${quoted}`, "mu"))?.[1];
  if (!found) throw new Error(`Live exploration evidence did not contain ${name}.`);
  return found;
}

function collectPageViews(value: unknown, views: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPageViews(item, views);
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key === "page" && typeof nested === "string") views.push(nested);
    else collectPageViews(nested, views);
  }
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
