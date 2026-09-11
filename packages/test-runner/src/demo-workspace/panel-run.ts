// Running a Flow from the panel and waiting on what the run produces: the
// dispatch responses, the rendered layout, and the scenario page's own result.
import type { Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { RunnerFailure } from "../failure.js";
import { exactVirtualizedHierarchyObject } from "../demo-llm-create-ui.js";
import { stableHierarchyNodeId } from "./selectors.js";
import { ensureNodesEditorVisible } from "./subflow-authoring.js";
import type { DemoWorkspaceState } from "./workspace-state.js";

export async function runDemoFlowFromPanel(page: Page, state: DemoWorkspaceState, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string; diagnostic: Record<string, unknown> }> {
  await page.bringToFront();
  const flowTreeItemId = `flow-${stableHierarchyNodeId(state.flowId)}`;
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "runtime-search", "Search the selected Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRow = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact Flow Runtime Debug row");
  await evidence.step("panel", "runtime-open", "Open Runtime Debug for the selected demo Flow", () => runtimeRow.click());
  const runCommand = page.locator(".automation-runtime-run-command");
  await runCommand.waitFor();
  await evidence.step("panel", "runtime-search-clear", "Clear the project hierarchy search", () => search.fill(""));
  await page.getByText("Checking Flow readiness...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  await evidence.step("panel", "runtime-no-llm", "Select No LLM intervention mode", () => runCommand.getByRole("button", { name: "No LLM intervention", exact: true }).click());
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

export async function waitForPanelRunResponse(page: Page, dispatch: () => Promise<void>): Promise<import("@playwright/test").Response> {
  let resolveResponse!: (response: import("@playwright/test").Response) => void;
  const responsePromise = new Promise<import("@playwright/test").Response>(resolve => { resolveResponse = resolve; });
  let rejectResponse!: (error: Error) => void;
  const rejectedResponsePromise = new Promise<never>((_resolve, reject) => { rejectResponse = reject; });
  const handler = (response: import("@playwright/test").Response) => {
    if (response.request().method() !== "POST") return;
    if (response.url().includes("/api/programs/automation-studio/run-runtime-session")) {
      resolveResponse(response);
      return;
    }
    const isLlmPreparation = response.url().includes("/api/programs/automation-studio/preflight-llm-execution")
      || response.url().includes("/api/programs/automation-studio/issue-llm-execution-grant");
    if (isLlmPreparation && !response.ok()) rejectResponse(new Error("The panel rejected LLM run preparation before runtime dispatch"));
  };
  page.on("response", handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await dispatch();
    return await Promise.race([
      responsePromise,
      rejectedResponsePromise,
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("Timed out waiting for the panel Flow run response")), 60_000); }),
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
