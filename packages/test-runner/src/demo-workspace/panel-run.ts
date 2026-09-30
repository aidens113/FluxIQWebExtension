// Running a Flow from the panel and waiting on what the run produces: the
// dispatch responses, the rendered layout, and the scenario page's own result.
import type { Locator, Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { RunnerFailure } from "../failure.js";
import { exactVirtualizedHierarchyObject } from "../demo-llm-create-ui/index.js";
import { stableHierarchyNodeId } from "./selectors.js";
import { ensureNodesEditorVisible } from "./subflow-authoring.js";
import type { DemoWorkspaceState } from "./workspace-state.js";

export async function runDemoFlowFromPanel(page: Page, state: DemoWorkspaceState, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string; diagnostic: Record<string, unknown> }> {
  await page.bringToFront();
  const flowTreeItemId = `flow-${stableHierarchyNodeId(state.flowId)}`;
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "runtime-search", "Search the selected Flow hierarchy for Run and test", () => search.fill("Run and test"));
  const runtimeRow = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact Flow Run and test row");
  await evidence.step("panel", "runtime-open", "Open Run and test for the selected demo Flow", () => runtimeRow.click());
  const runCommand = runPanel(page).locator(".automation-runtime-run-command");
  await runCommand.waitFor();
  await evidence.step("panel", "runtime-search-clear", "Clear the project hierarchy search", () => search.fill(""));
  await page.getByText(RUN_READINESS_CHECK_TEXT, { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  await selectRunMode(page, "No LLM intervention", evidence, "runtime-no-llm");
  const runButton = runCommand.getByRole("button", { name: "Run", exact: true });
  const readyDeadline = Date.now() + 30_000;
  while (Date.now() < readyDeadline && await runButton.isDisabled()) await page.waitForTimeout(100);
  if (await runButton.isDisabled()) {
    const issue = await page.locator(".automation-runtime-readiness").innerText().catch(() => "Flow readiness did not produce a visible result");
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel reported the demo Flow is not ready: " + issue.replace(/\s+/gu, " ").trim());
  }
  const response = await evidence.step("panel", "runtime-run", "Run the deterministic Flow", async () => {
    return waitForPanelRunResponse(page, () => runButton.click());
  });
  const body = await response.json() as any;
  const runId = body?.payload?.runtimeSession?.runId;
  if (!response.ok() || typeof runId !== "string") throw new RunnerFailure("runtime.behavior", body?.error ?? "Panel Flow run failed");
  const status = String(body?.payload?.runtimeSession?.status ?? "unknown");
  const diagnostic = {
    runId,
    status,
    terminalReason: body?.payload?.terminalReason ?? "",
    message: body?.payload?.runtimeSession?.trace?.message ?? "",
    actionAttemptCount: body?.payload?.runSummary?.actionAttemptCount ?? 0,
  };
  return { runId, status, diagnostic };
}

/**
 * The "Run and test" view's own run panel. The Steps pane's authoring region
 * shares its `automation-runtime-run-panel` and `-run-command` classes, so the
 * run panel is told apart from it, and only the visible one is taken.
 */
export function runPanel(page: Page): Locator {
  return page.locator("section.automation-runtime-run-panel:not(.automation-flow-authoring-panel):visible");
}

/** What the run panel shows while it checks the Flow (was "Checking Flow readiness..." before Core 68bad85). */
export const RUN_READINESS_CHECK_TEXT = "Checking whether this is ready to run...";

/**
 * Chooses how the next run runs. Since Core 68bad85 the mode buttons sit in a
 * collapsed "Advanced" disclosure under the run command, so it is opened first
 * when it is closed; the buttons keep their labels.
 */
export async function selectRunMode(page: Page, mode: string, evidence: BrowserEvidenceRecorder, step: string): Promise<void> {
  const advanced = runPanel(page).locator("details.automation-runtime-advanced-mode");
  await advanced.waitFor({ timeout: 30_000 });
  if (!await advanced.evaluate(element => (element as HTMLDetailsElement).open)) {
    await evidence.step("panel", step + "-advanced", "Open the Advanced run options", () => advanced.locator(":scope > summary").click());
  }
  await evidence.step("panel", step, `Select ${mode} mode`, () => advanced.getByRole("button", { name: mode, exact: true }).click());
}

export async function assertDemoFlowRenderedLayout(page: Page, evidence: BrowserEvidenceRecorder, expectedNodeCounts: readonly number[] = [4, 5]): Promise<void> {
  await ensureNodesEditorVisible(page, evidence, "flow-layout");
  await page.locator(".react-flow__node[data-id]").first().waitFor({ timeout: 30_000 });
  const rectangles = await page.locator(".react-flow__node[data-id]").evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { id: element.getAttribute("data-id") ?? "unknown", left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  if (!expectedNodeCounts.includes(rectangles.length)) throw new RunnerFailure("runtime.behavior", `Expected ${expectedNodeCounts.join(" or ")} recording-derived nodes, found ${rectangles.length}`);
  for (let leftIndex = 0; leftIndex < rectangles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rectangles.length; rightIndex += 1) {
      const left = rectangles[leftIndex]!;
      const right = rectangles[rightIndex]!;
      const overlaps = left.left < right.right - 1 && left.right > right.left + 1 && left.top < right.bottom - 1 && left.bottom > right.top + 1;
      if (overlaps) throw new RunnerFailure("runtime.behavior", `Rendered demo Flow nodes overlap: ${left.id} and ${right.id}`);
    }
  }
}

export async function waitForSubmittedDemoPage(seedPage: Page): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const page of seedPage.context().pages()) {
      if (await page.getByTestId("result").filter({ hasText: "Submitted" }).isVisible().catch(() => false)) return;
    }
    await seedPage.waitForTimeout(100);
  }
  throw new RunnerFailure("runtime.behavior", "Recording-generated Flow completed without producing the submitted demo result in any extension-controlled tab");
}

/**
 * How long a panel run may take to answer. Core answers `run-runtime-session`
 * only once the run is terminal, so a run whose recovery ladder retries a
 * missing target answers late. Measured on 2026-09-29 (ui:e2e run
 * r20260929t232702-0470, headed, shared machine): the drifted run's three
 * failed click attempts had ended 45 s after Run and no answer came by 60 s,
 * the old bound. A run that answers returns at once, so the bound costs only a
 * failure.
 */
const PANEL_RUN_RESPONSE_TIMEOUT_MS = 180_000;

export async function waitForPanelRunResponse(page: Page, dispatch: () => Promise<void>, timeoutMs = PANEL_RUN_RESPONSE_TIMEOUT_MS): Promise<import("@playwright/test").Response> {
  // The panel runs a Flow the model takes part in with one request: a model
  // call needs no grant, so there is no preparation request to fail first.
  let resolveResponse!: (response: import("@playwright/test").Response) => void;
  const responsePromise = new Promise<import("@playwright/test").Response>(resolve => { resolveResponse = resolve; });
  const handler = (response: import("@playwright/test").Response) => {
    if (response.request().method() !== "POST") return;
    if (response.url().includes("/api/programs/automation-studio/run-runtime-session")) resolveResponse(response);
  };
  page.on("response", handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await dispatch();
    return await Promise.race([
      responsePromise,
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new RunnerFailure("runtime.behavior", "Timed out waiting for the panel Flow run response", { details: { reasonCode: "panel_run.response_timeout", timeoutMs } })), timeoutMs); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    page.off("response", handler);
  }
}

export async function waitForPanelMutationResponse(page: Page, endpoint: string, dispatch: () => Promise<void>): Promise<import("@playwright/test").Response> {
  let resolveResponse!: (response: import("@playwright/test").Response) => void;
  const responsePromise = new Promise<import("@playwright/test").Response>(resolve => { resolveResponse = resolve; });
  const handler = (response: import("@playwright/test").Response) => {
    if (response.url().includes(endpoint) && response.request().method() === "POST") resolveResponse(response);
  };
  page.on("response", handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await dispatch();
    return await Promise.race([
      responsePromise,
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("Timed out waiting for panel mutation " + endpoint)), 60_000); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    page.off("response", handler);
  }
}
