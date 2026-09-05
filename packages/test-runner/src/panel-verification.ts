import type { BrowserContext, Page } from "@playwright/test";

export type FluxIQSessionCookieDescriptor = {
  name: "fluxiq_session";
  value: string;
  url: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "Lax";
};

export type FluxIQPanelVerificationOutcome = {
  status: "verified" | "limited";
  panelUrl: string;
  project: { projectId: string; status: "verified"; basis: "exact-url-and-rendered-project-shell" };
  flow: { flowId: string; status: "verified"; basis: "selected-hierarchy-item" };
  run: { status: "not-requested" } | {
    runId: string;
    status: "verified" | "limited";
    basis?: "selected-run-row-and-rendered-action-log";
    limitation?: "run-detail-deep-link-not-authoritative-and-run-row-not-selectable";
  };
};

export type VerifyFluxIQPanelInput = {
  context: BrowserContext;
  origin: string;
  sessionCookieValue: string;
  projectId: string;
  flowId: string;
  runId?: string;
  timeoutMs?: number;
};

export class FluxIQPanelVerificationError extends Error {
  readonly code = "panel-verification-failed";
  constructor(readonly phase: "cookie" | "navigation" | "project" | "flow") {
    super(`FluxIQ panel verification failed during ${phase}.`);
    this.name = "FluxIQPanelVerificationError";
  }
}

export function fluxIQSessionCookieDescriptor(origin: string, sessionCookieValue: string): FluxIQSessionCookieDescriptor {
  const normalizedOrigin = exactHttpOrigin(origin);
  if (!sessionCookieValue || /[;\r\n\0-\x1f\x7f]/u.test(sessionCookieValue)) {
    throw new Error("A parsed FluxIQ session cookie value is required.");
  }
  return {
    name: "fluxiq_session",
    value: sessionCookieValue,
    url: normalizedOrigin,
    httpOnly: true,
    secure: normalizedOrigin.startsWith("https://"),
    sameSite: "Lax",
  };
}

export function buildFluxIQPanelVerificationUrl(input: {
  origin: string;
  projectId: string;
  flowId: string;
  runId?: string;
}): string {
  const origin = exactHttpOrigin(input.origin);
  const projectId = requiredIdentifier(input.projectId, "project");
  const flowId = requiredIdentifier(input.flowId, "Flow");
  const url = new URL("/programs/automation-studio", origin);
  url.searchParams.set("project", projectId);
  url.searchParams.set("flow", flowId);
  url.searchParams.set("view", "runtime-debug");
  if (input.runId !== undefined) url.searchParams.set("detail", `run:${requiredIdentifier(input.runId, "run")}`);
  return url.toString();
}

/** Mirrors Automation Studio's stable root-Flow tree key for exact DOM selection. */
export function automationStudioFlowTreeItemId(flowId: string): string {
  const value = requiredIdentifier(flowId, "Flow");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return `flow-${hash.toString(36)}`;
}

export async function verifyAuthenticatedFluxIQPanel(input: VerifyFluxIQPanelInput): Promise<FluxIQPanelVerificationOutcome> {
  const timeoutMs = boundedTimeout(input.timeoutMs);
  const panelUrl = buildFluxIQPanelVerificationUrl(input);
  let phase: FluxIQPanelVerificationError["phase"] = "cookie";
  try {
    await input.context.addCookies([fluxIQSessionCookieDescriptor(input.origin, input.sessionCookieValue)]);
    phase = "navigation";
    const page = await input.context.newPage();
    await page.goto(panelUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.locator(".automation-studio-shell").waitFor({ state: "visible", timeout: timeoutMs });

    phase = "project";
    await ensureProjectHierarchyVisible(page, timeoutMs);

    phase = "flow";
    const flowItemId = automationStudioFlowTreeItemId(input.flowId);
    const flowItem = page.locator(`[role="treeitem"][data-tree-item-id=${JSON.stringify(flowItemId)}]`);
    await flowItem.waitFor({ state: "visible", timeout: timeoutMs });
    await waitForSelected(flowItem, timeoutMs);

    const run = input.runId
      ? await attemptRunVerification(page, input.runId, timeoutMs)
      : { status: "not-requested" as const };
    return {
      status: run.status === "limited" ? "limited" : "verified",
      panelUrl,
      project: { projectId: input.projectId, status: "verified", basis: "exact-url-and-rendered-project-shell" },
      flow: { flowId: input.flowId, status: "verified", basis: "selected-hierarchy-item" },
      run,
    };
  } catch (error) {
    if (error instanceof FluxIQPanelVerificationError) throw error;
    throw new FluxIQPanelVerificationError(phase);
  }
}

async function ensureProjectHierarchyVisible(page: Page, timeoutMs: number): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  if (!await hierarchy.isVisible().catch(() => false)) {
    const expand = page.getByRole("button", { name: "Expand sidebar" });
    if (await expand.isVisible().catch(() => false)) await expand.click();
  }
  await hierarchy.waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByRole("button", { name: "Back to Projects" }).waitFor({ state: "visible", timeout: timeoutMs });
}

async function waitForSelected(locator: ReturnType<Page["locator"]>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (await locator.getAttribute("aria-selected") === "true") return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Flow selection was not rendered.");
}

async function attemptRunVerification(
  page: Page,
  runId: string,
  timeoutMs: number,
): Promise<Extract<FluxIQPanelVerificationOutcome["run"], { runId: string }>> {
  const limited = {
    runId,
    status: "limited" as const,
    limitation: "run-detail-deep-link-not-authoritative-and-run-row-not-selectable" as const,
  };
  try {
    const actionLog = page.locator(".automation-runtime-log-page");
    if (await renderedRunId(actionLog, runId)) return verifiedRun(runId);

    const search = page.getByRole("textbox", { name: "Find a run" });
    await search.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5_000) });
    await search.fill(runId);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const row = page.locator("article.automation-runtime-run-row").filter({
      has: page.locator(`strong[title=${JSON.stringify(runId)}]`),
    });
    await row.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5_000) });
    await row.click();
    await actionLog.waitFor({ state: "visible", timeout: Math.min(timeoutMs, 5_000) });
    return await renderedRunId(actionLog, runId) ? verifiedRun(runId) : limited;
  } catch {
    return limited;
  }
}

async function renderedRunId(actionLog: ReturnType<Page["locator"]>, runId: string): Promise<boolean> {
  if (!await actionLog.isVisible().catch(() => false)) return false;
  return actionLog.getByText(runId, { exact: false }).isVisible().catch(() => false);
}

function verifiedRun(runId: string): Extract<FluxIQPanelVerificationOutcome["run"], { runId: string }> {
  return { runId, status: "verified", basis: "selected-run-row-and-rendered-action-log" };
}

function exactHttpOrigin(input: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("FluxIQ origin must be an exact HTTP(S) origin."); }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("FluxIQ origin must be an exact HTTP(S) origin.");
  }
  return url.origin;
}

function requiredIdentifier(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} ID is required.`);
  return value.trim();
}

function boundedTimeout(value: number | undefined): number {
  if (value === undefined) return 20_000;
  if (!Number.isFinite(value) || value < 100 || value > 120_000) throw new Error("Panel verification timeout must be between 100 and 120000 milliseconds.");
  return Math.trunc(value);
}
