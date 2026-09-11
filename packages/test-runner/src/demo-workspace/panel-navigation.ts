// Moving around the panel: Automation Studio, a project, a Flow, a Subflow,
// and the connected-clients pairing surface.
import type { Locator, Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { RunnerFailure } from "../failure.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";
import { escapeCssAttribute, escapeRegExp } from "./selectors.js";
import { ensureNodesEditorVisible } from "./subflow-authoring.js";
import type { DemoWorkspaceState } from "./workspace-state.js";

export async function openAutomationStudio(page: Page, origin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await evidence.step("panel", "open-web-automation-studio", "Open Automation Studio in the Web Automation domain", () => page.goto(origin + "/programs/automation-studio?domainId=web-automation", { waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
}

export async function openProjectInPanel(page: Page, origin: string, projectName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const current = page.locator(".automation-studio-sidebar-heading").getByText(projectName, { exact: true });
  if (await current.isVisible().catch(() => false)) return;
  await openAutomationStudio(page, origin, evidence);
  await page.getByText("Loading projects...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const search = page.getByLabel("Search projects");
  await evidence.step("panel", "project-search", "Search for the demo project", () => search.fill(projectName));
  const row = page.locator(".automation-project-row").filter({ hasText: projectName }).first();
  if (!await row.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) {
    const retry = page.getByRole("button", { name: /^(?:Retry|Refresh)$/u });
    if (!await retry.isVisible().catch(() => false)) throw new RunnerFailure("runtime.behavior", "The demo project is unavailable in the project list");
    await evidence.step("panel", "project-list-retry", "Retry loading the project list", () => retry.click());
    await page.getByText("Loading projects...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
    await evidence.step("panel", "project-search-retry", "Search the reloaded project list", () => search.fill(projectName));
    await row.waitFor({ state: "visible", timeout: 10_000 });
  }
  await evidence.step("panel", "project-open", "Open the demo project", () => row.locator(".automation-project-row-main").click());
  await page.locator(".automation-studio-sidebar-heading").getByText(projectName, { exact: true }).waitFor();
}

export function hierarchyRow(page: Page, label: string): Locator {
  return page.locator(".tree-row-main").filter({ hasText: new RegExp("^" + escapeRegExp(label)) }).first();
}

export async function selectFlowInCurrentProject(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<string> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  const typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
  if (await typeFilter.inputValue({ timeout: 2_000 }) !== "all") {
    await evidence.step("panel", "flow-select-type-reset", "Show all hierarchy object types", () => typeFilter.selectOption("all"));
  }
  await evidence.step("panel", "flow-select-search", "Locate the exact Flow", () => search.fill(flowName));
  const items = hierarchy.getByRole("treeitem", { name: flowName, exact: true });
  await items.first().waitFor({ timeout: 10_000 });
  if (await items.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow hierarchy identity is ambiguous");
  const item = items.first();
  await evidence.step("panel", "flow-select", "Select the exact Flow", () => item.locator(".tree-row-main.type-flow").click());
  if (await item.getAttribute("aria-expanded") === "false") {
    await evidence.step("panel", "flow-select-expand", "Expand the exact Flow", () => item.getByRole("button", { name: `Expand ${flowName}` }).click());
  }
  const itemId = await item.getAttribute("data-tree-item-id");
  if (!itemId) throw new RunnerFailure("runtime.behavior", "The exact Flow hierarchy identity is unavailable");
  return itemId;
}

export async function openFlowInCurrentProject(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<string> {
  let stage = "hierarchy-baseline";
  let typeFilterNormalized = false;
  let searchCleared = false;
  let stableIdCandidateCount = 0;
  let exactFlowCandidateCount = 0;
  let routerSearchApplied = false;
  let filteredAncestorFlowCount = 0;
  let routerActivationRequested = false;
  let routerChildCount = 0;
  let routerTabCount = 0;
  try {
    const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
    const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
    const typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
    if (await typeFilter.inputValue({ timeout: 2_000 }) !== "all") {
      await evidence.step("panel", "flow-type-filter-reset", "Show all project hierarchy object types before locating a Flow", () => typeFilter.selectOption("all", { timeout: 2_000 }));
    }
    typeFilterNormalized = await typeFilter.inputValue({ timeout: 2_000 }) === "all";
    if (!typeFilterNormalized) throw new RunnerFailure("runtime.behavior", "FluxIQ panel hierarchy object filter could not be normalized");
    stage = "filtered-flow";
    await evidence.step("panel", "flow-search", "Search the project hierarchy for the demo Flow", () => search.fill(flowName));
    const flowTreeItem = hierarchy.getByRole("treeitem", { name: flowName, exact: true });
    const flowRow = flowTreeItem.locator(".tree-row-main.type-flow");
    await flowTreeItem.waitFor({ timeout: 10_000 });
    await evidence.step("panel", "flow-open", "Preview the demo Flow through its hierarchy row", () => flowRow.click());
    const flowTreeItemId = await flowTreeItem.getAttribute("data-tree-item-id");
    if (!flowTreeItemId) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow hierarchy identity is unavailable");

    stage = "stable-flow";
    const stableIdCandidates = page.locator(`.automation-tree-item[data-tree-item-id="${escapeCssAttribute(flowTreeItemId)}"]`);
    stableIdCandidateCount = await stableIdCandidates.count();
    const stableFlowTreeItems = stableIdCandidates.filter({
      has: page.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(flowName, { exact: true }),
    });
    const stableFlowTreeItem = stableFlowTreeItems.first();
    await stableFlowTreeItem.waitFor({ timeout: 10_000 });
    exactFlowCandidateCount = await stableFlowTreeItems.count();
    if (exactFlowCandidateCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow hierarchy identity is ambiguous while filtered");
    if (await stableFlowTreeItem.getAttribute("aria-expanded") === "false") {
      await evidence.step("panel", "flow-expand", "Expand the demo Flow hierarchy", () => stableFlowTreeItem.getByRole("button", { name: `Expand ${flowName}` }).click());
    }

    stage = "router-search";
    await evidence.step("panel", "flow-router-search", "Search the real project hierarchy for Router rows", () => search.fill("Router"));
    routerSearchApplied = true;

    stage = "router-child";
    const routerTreeItems = page.locator(`.automation-tree-item[data-tree-item-id="${escapeCssAttribute(`${flowTreeItemId}-router`)}"]`);
    const routerTreeItem = routerTreeItems.first();
    await routerTreeItem.waitFor({ timeout: 10_000 });
    routerChildCount = await routerTreeItems.count();
    if (routerChildCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow Router hierarchy identity is ambiguous");

    stage = "router-view";
    const routerTab = page.getByRole("tab", { name: `Router: ${flowName}`, exact: true });
    await evidence.step("panel", "flow-router-activate", "Activate the exact Flow-owned Router while the hierarchy is filtered", () => routerTreeItem.locator(".tree-row-main.type-flow-object").click());
    routerActivationRequested = true;
    const previewDeadline = Date.now() + 1_500;
    while (Date.now() < previewDeadline && !await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) await page.waitForTimeout(100);
    if (!await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) {
      await evidence.step("panel", "flow-open-pane", "Open the exact Flow-owned Router in a dedicated workspace pane", () => routerTreeItem.locator(".tree-row-main.type-flow-object").dblclick());
    }
    const selectionDeadline = Date.now() + 10_000;
    while (Date.now() < selectionDeadline && !await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) await page.waitForTimeout(100);
    if (!await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) {
      routerTabCount = await routerTab.count();
      throw new RunnerFailure("runtime.behavior", "FluxIQ panel did not activate the requested Flow Router view");
    }
    stage = "router-search-clear";
    await evidence.step("panel", "flow-search-clear", "Clear the project hierarchy search after Router activation", () => search.fill(""));
    searchCleared = true;
    await evidence.diagnostic("panel", "flow-open-complete", "flow-open.complete", { flowOpened: true });
    return flowTreeItemId;
  } catch {
    await evidence.diagnostic("panel", stage, `flow-open.${stage}`, {
      typeFilterNormalized,
      searchCleared,
      stableIdCandidateCount,
      exactFlowCandidateCount,
      routerSearchApplied,
      filteredAncestorFlowCount,
      routerActivationRequested,
      routerChildCount,
      routerTabCount,
    }).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not activate the requested Flow Router through the hierarchy");
  }
}

export async function exactFlowRouterUiIsActive(routerTreeItem: Locator, routerTab: Locator): Promise<boolean> {
  return await routerTreeItem.getAttribute("aria-selected") === "true"
    && await routerTab.count() === 1
    && await routerTab.getAttribute("aria-selected") === "true";
}

export async function openSubflowInCurrentProject(page: Page, subflowName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const search = page.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "subflow-search", "Search for the primary demo Subflow", () => search.fill(subflowName));
  await evidence.step("panel", "subflow-open", "Open the primary Subflow Nodes editor", () => hierarchyRow(page, subflowName).click());
  await ensureNodesEditorVisible(page, evidence, "subflow-nodes");
  await evidence.step("panel", "subflow-search-clear", "Clear the project hierarchy search", () => search.fill(""));
}

export async function openDemoFlowInPanel(page: Page, config: DemoWorkspaceConfiguration, state: DemoWorkspaceState, evidence: BrowserEvidenceRecorder): Promise<void> {
  await openProjectInPanel(page, config.origin, state.projectName, evidence);
  await openFlowInCurrentProject(page, state.flowName, evidence);
}

export async function openConnectedClients(page: Page, evidence: BrowserEvidenceRecorder): Promise<void> {
  const tab = page.getByRole("tab", { name: /Connected Clients/u });
  if (await tab.count()) { await evidence.step("panel", "clients-tab-open", "Open Connected Clients", () => tab.click()); return; }
  await evidence.step("panel", "clients-add-tab", "Open the panel tab picker", () => page.getByRole("button", { name: "Add tab" }).first().click());
  const picker = page.locator(".automation-window-adder-panel:visible");
  await evidence.step("panel", "clients-tab-search", "Search for Connected Clients", () => picker.getByRole("searchbox").fill("connected"));
  await evidence.step("panel", "clients-tab-select", "Select Connected Clients", () => picker.getByRole("button", { name: /^Connected Clients/u }).click());
  const selectedTab = page.getByRole("tab", { name: /Connected Clients/u });
  await selectedTab.waitFor();
  if (await selectedTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", "clients-tab-activate", "Activate the Connected Clients tab", () => selectedTab.click());
  }
  await page.getByRole("strong").filter({ hasText: "Connected Clients" }).waitFor();
}

export async function approvePairingInPanel(page: Page, referenceCode: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await page.bringToFront();
  const globalDialog = page.getByRole("dialog", { name: "Client pairing request" });
  await globalDialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  if (await globalDialog.isVisible().catch(() => false)) {
    if (!await globalDialog.getByText(referenceCode, { exact: true }).isVisible().catch(() => false)) {
      throw new RunnerFailure("gateway.pairing", "The global pairing prompt did not match the extension reference code");
    }
    await evidence.step("panel", "pairing-confirm", "Confirm the matching extension pairing request", () => globalDialog.getByRole("button", { name: "Confirm pairing" }).click());
    await globalDialog.waitFor({ state: "hidden" });
    return;
  }
  await openConnectedClients(page, evidence);
  const approvalPanel = page.locator(".automation-client-panel").filter({ hasText: "Approval" }).first();
  const approve = approvalPanel.locator("span").filter({ hasText: referenceCode }).getByRole("button", { name: "Approve" }).first();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !await approve.isVisible().catch(() => false)) {
    await evidence.step("panel", "pairing-refresh", "Refresh Connected Clients pairing requests", () => page.getByRole("button", { name: "Refresh" }).click());
    await page.waitForTimeout(200);
  }
  if (!await approve.isVisible().catch(() => false)) throw new RunnerFailure("gateway.pairing", "Pairing request did not appear in the FluxIQ panel");
  await evidence.step("panel", "pairing-approve", "Approve the extension pairing request", () => approve.click());
}
