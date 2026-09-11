// Authoring a Subflow through the panel: locating the Flow-owned Subflows
// folder, creating the Subflow, and making the nodes and Router editors visible.
import type { Locator, Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { RunnerFailure } from "../failure.js";
import { hierarchyRow, openFlowInCurrentProject } from "./panel-navigation.js";
import { DEMO_SUBFLOW_NAME } from "./provisioning.js";
import { escapeCssAttribute, escapeRegExp } from "./selectors.js";

export type FlowOwnedSubflowsFolderResolution = {
  folder: Locator;
  hierarchyControlsAvailable(timeout?: number): Promise<boolean>;
  restoreHierarchyFilters(timeout?: number): Promise<boolean>;
};

export async function requireFlowOwnedSubflowsFolder(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<FlowOwnedSubflowsFolderResolution> {
  let stage = "flow";
  let flowOpened = false;
  let filtersApplied = false;
  let filterMatchCount = 0;
  let traversalCount = 0;
  let parentScopedCount = 0;
  let exactSubflowsCount = 0;
  let addActionCount = 0;
  let search: Locator | undefined;
  let typeFilter: Locator | undefined;
  let originalSearch = "";
  let originalTypeFilter = "all";
  let filtersRestored = false;
  let hierarchy: Locator | undefined;
  const hierarchyControlsAvailable = async (timeout: number = 1_000): Promise<boolean> => {
    if (!hierarchy || !search || !typeFilter) return false;
    try {
      await hierarchy.waitFor({ state: "visible", timeout });
      await search.waitFor({ state: "visible", timeout });
      await typeFilter.waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  };
  const restoreHierarchyFilters = async (timeout: number = 1_000): Promise<boolean> => {
    if (!filtersApplied || filtersRestored) return true;
    if (!search || !typeFilter || !await hierarchyControlsAvailable(timeout)) return false;
    if (await search.inputValue({ timeout }) !== originalSearch) {
      await evidence.step("panel", "subflow-folder-search-restore", "Restore the project hierarchy search after locating Subflows", () => search!.fill(originalSearch, { timeout }));
    }
    if (await typeFilter.inputValue({ timeout }) !== originalTypeFilter) {
      await evidence.step("panel", "subflow-folder-type-restore", "Restore the project hierarchy object filter after locating Subflows", () => typeFilter!.selectOption(originalTypeFilter, { timeout }));
    }
    filtersRestored = true;
    return true;
  };
  try {
    const flowTreeItemId = await openFlowInCurrentProject(page, flowName, evidence);
    flowOpened = true;
    hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
    search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
    typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
    originalSearch = await search.inputValue();
    originalTypeFilter = await typeFilter.inputValue();
    filtersApplied = true;

    stage = "subflows-filter";
    if (originalTypeFilter !== "folder") {
      await evidence.step("panel", "subflow-folder-type-filter", "Filter the real project hierarchy to folders", () => typeFilter!.selectOption("folder"));
    }
    if (originalSearch !== "Subflows") {
      await evidence.step("panel", "subflow-folder-search", "Search the real project hierarchy for Subflows folders", () => search!.fill("Subflows"));
    }
    const matchStatus = hierarchy.locator(".automation-tree-filter-row small");
    await matchStatus.waitFor({ timeout: 10_000 });
    const match = /^(\d+) matches?$/u.exec((await matchStatus.textContent())?.trim() ?? "");
    filterMatchCount = match ? Number.parseInt(match[1]!, 10) : 0;

    stage = "subflows-render";
    const parentScopedItems = page.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"]`);
    const exactSubflowsItems = parentScopedItems.filter({
      has: page.locator(".tree-row-main.type-folder .tree-row-label > strong").getByText("Subflows", { exact: true }),
    });
    const subflowsFolder = exactSubflowsItems.first();
    await subflowsFolder.waitFor({ timeout: 1_000 }).catch(() => undefined);
    if (!await subflowsFolder.count()) {
      stage = "subflows-traversal";
      const tree = page.getByRole("navigation", { name: "Automation Studio project tree" });
      const mountedTreeItem = tree.getByRole("treeitem").first();
      await mountedTreeItem.waitFor({ timeout: 10_000 });
      await evidence.step("panel", "subflow-folder-traversal-focus", "Focus the filtered project hierarchy", () => mountedTreeItem.focus());
      await evidence.step("panel", "subflow-folder-traversal-home", "Start at the beginning of the filtered hierarchy", () => page.keyboard.press("Home"));
      const traversalLimit = Math.min(256, Math.max(8, filterMatchCount * 2 + 2));
      while (!await subflowsFolder.count() && traversalCount < traversalLimit) {
        traversalCount += 1;
        await evidence.step("panel", `subflow-folder-traversal-${traversalCount}`, "Traverse the filtered hierarchy toward the requested Flow-owned Subflows folder", () => page.keyboard.press("ArrowDown"));
      }
    }
    await subflowsFolder.waitFor({ timeout: 10_000 });
    parentScopedCount = await parentScopedItems.count();
    exactSubflowsCount = await exactSubflowsItems.count();
    stage = "subflows-identity";
    if (exactSubflowsCount !== 1 || await subflowsFolder.getAttribute("aria-label") !== "Subflows") {
      throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow-owned Subflows hierarchy identity is ambiguous");
    }
    const addAction = subflowsFolder.getByRole("button", { name: "Add inside Subflows", exact: true });
    addActionCount = await addAction.count();
    stage = "add-action";
    if (addActionCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow-owned Subflows add action is unavailable");
    return { folder: subflowsFolder, hierarchyControlsAvailable, restoreHierarchyFilters };
  } catch {
    await restoreHierarchyFilters().catch(() => undefined);
    await evidence.diagnostic("panel", `subflow-folder-${stage}`, `subflow-folder.${stage}`, {
      flowOpened,
      filtersApplied,
      filtersRestored,
      filterMatchCount,
      traversalCount,
      parentScopedCount,
      exactSubflowsCount,
      addActionCount,
    }).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not resolve the requested Flow-owned Subflows folder");
  }
}

export async function createDemoSubflowInPanel(page: Page, flowName: string, pin: string, evidence: BrowserEvidenceRecorder, subflowName: string = DEMO_SUBFLOW_NAME): Promise<void> {
  const subflows = await requireFlowOwnedSubflowsFolder(page, flowName, evidence);
  const dialog = page.getByRole("dialog", { name: "Add to Subflows" });
  const form = page.getByRole("dialog", { name: "Create Subflow" });
  let stage = "open";
  let modalDismissAttempted = false;
  let dialogClosed = false;
  let hierarchyAvailable = false;
  let filtersRestored = false;
  try {
    await evidence.step("panel", "subflow-create-open", "Open the real panel Subflow creation dialog", () => subflows.folder.getByRole("button", { name: "Add inside Subflows", exact: true }).click());
    await dialog.waitFor({ timeout: 10_000 });
    stage = "kind";
    await evidence.step("panel", "subflow-create-kind", "Choose an executable Subflow", () => dialog.getByRole("button", { name: /^Subflow/u }).click());
    stage = "form";
    await form.waitFor({ timeout: 10_000 });
    await evidence.step("panel", "subflow-create-name", "Name the primary browser automation Subflow", () => form.getByLabel("Name").fill(subflowName));
    await evidence.step("panel", "subflow-create-pin", "Authorize Subflow creation", () => form.getByLabel("Security PIN").fill(pin), { sensitive: true });
    stage = "submit";
    await evidence.step("panel", "subflow-create-submit", "Create the primary Subflow", () => form.getByRole("button", { name: "Create", exact: true }).click(), { sensitive: true });
    await form.waitFor({ state: "hidden", timeout: 30_000 });
    dialogClosed = true;
    stage = "hierarchy";
    hierarchyAvailable = await subflows.hierarchyControlsAvailable(2_000);
    filtersRestored = await subflows.restoreHierarchyFilters(2_000);
    if (!hierarchyAvailable || !filtersRestored) throw new RunnerFailure("runtime.behavior", "FluxIQ panel hierarchy did not return after Subflow creation");
    stage = "created-row";
    await hierarchyRow(page, subflowName).waitFor({ timeout: 30_000 });
    return;
  } catch {
    const visibleForm = await form.isVisible().catch(() => false);
    const visibleChooser = !visibleForm && await dialog.isVisible().catch(() => false);
    const activeDialog = visibleForm ? form : visibleChooser ? dialog : undefined;
    if (activeDialog) {
      const cancel = activeDialog.getByRole("button", { name: "Cancel", exact: true });
      if (await cancel.count() === 1) {
        modalDismissAttempted = true;
        await evidence.step("panel", "subflow-create-cancel", "Close the incomplete Subflow creation workflow before restoring hierarchy filters", () => cancel.click({ timeout: 2_000 }), { sensitive: true }).catch(() => undefined);
        await activeDialog.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
      }
      dialogClosed = !await activeDialog.isVisible().catch(() => false);
    }
    hierarchyAvailable = await subflows.hierarchyControlsAvailable(1_000);
    filtersRestored = await subflows.restoreHierarchyFilters(1_000).catch(() => false);
    await evidence.diagnostic("panel", `subflow-create-${stage}`, `subflow-create.${stage}`, {
      modalDismissAttempted,
      dialogClosed,
      hierarchyAvailable,
      filtersRestored,
    }).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not complete the Subflow creation workflow");
  }
}

export async function ensureNodesEditorVisible(page: Page, evidence: BrowserEvidenceRecorder, stepPrefix: string): Promise<Locator> {
  const canvas = page.getByLabel("Nodes whiteboard");
  if (await canvas.isVisible().catch(() => false)) return canvas;
  await canvas.waitFor({ timeout: 3_000 }).catch(() => undefined);
  if (await canvas.isVisible().catch(() => false)) return canvas;

  let nodesTab = page.getByRole("tab", { name: /^Nodes(?::|$)/u }).first();
  if (!await nodesTab.count()) {
    await evidence.step("panel", stepPrefix + "-add-tab", "Open the panel tab picker for Nodes", () => page.getByRole("button", { name: "Add tab" }).first().click());
    const picker = page.locator(".automation-window-adder-panel:visible");
    await evidence.step("panel", stepPrefix + "-search-tab", "Search the tab picker for Nodes", () => picker.getByRole("searchbox").fill("nodes"));
    await evidence.step("panel", stepPrefix + "-select-tab", "Select the Nodes view", () => picker.getByRole("button", { name: /^Nodes/u }).click());
    nodesTab = page.getByRole("tab", { name: /^Nodes(?::|$)/u }).first();
    await nodesTab.waitFor({ timeout: 10_000 });
  }
  if (await nodesTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", stepPrefix + "-activate-tab", "Activate the selected Subflow Nodes view", () => nodesTab.click());
  }
  try {
    await canvas.waitFor({ timeout: 30_000 });
  } catch (cause) {
    const tabs = (await page.getByRole("tab").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    const alerts = (await page.getByRole("alert").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel did not open the selected Subflow Nodes canvas: " + JSON.stringify({ tabs, alerts }), { cause });
  }
  return canvas;
}

export async function ensureRouterEditorVisible(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  let routerTab = page.getByRole("tab", { name: `Router: ${flowName}`, exact: true });
  if (!await routerTab.count()) {
    await evidence.step("panel", "router-add-tab", "Open the panel tab picker for Router", () => page.getByRole("button", { name: "Add tab" }).first().click());
    const picker = page.locator(".automation-window-adder-panel:visible");
    await evidence.step("panel", "router-search-tab", "Search the tab picker for Router", () => picker.getByRole("searchbox").fill("router"));
    await evidence.step("panel", "router-select-tab", "Select the Router view", () => picker.getByRole("button", { name: /^Router/u }).click());
    routerTab = page.getByRole("tab", { name: `Router: ${flowName}`, exact: true });
    await routerTab.waitFor({ timeout: 10_000 });
  }
  if (await routerTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", "router-open", "Open the parent Flow Router", () => routerTab.click());
  }
  try {
    await page.getByRole("button", { name: "Edit fallback behavior" }).waitFor({ timeout: 30_000 });
  } catch (cause) {
    const tabs = (await page.getByRole("tab").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    const alerts = (await page.getByRole("alert").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel did not open the selected Flow Router editor: " + JSON.stringify({ tabs, alerts }), { cause });
  }
}

export async function configureDemoRouterFallbackInPanel(page: Page, flowName: string, subflowName: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await ensureRouterEditorVisible(page, flowName, evidence);
  await evidence.step("panel", "router-fallback-open", "Open Router fallback configuration", () => page.getByRole("button", { name: "Edit fallback behavior" }).click());
  const dialog = page.getByRole("dialog", { name: "Fallback behavior" });
  await evidence.step("panel", "router-fallback-kind", "Route unmatched runs to the primary Subflow", () => dialog.getByRole("radio", { name: /Continue to a subflow/u }).click());
  await evidence.step("panel", "router-fallback-target", "Choose the primary Subflow as Router fallback", async () => {
    const combobox = dialog.getByRole("combobox", { name: "Fallback subflow" });
    if ((await combobox.inputValue()).trim() === subflowName) return;
    await combobox.click();
    await dialog.getByRole("option", { name: new RegExp("^" + escapeRegExp(subflowName)) }).click();
  });
  await evidence.step("panel", "router-fallback-save", "Request saving the Router fallback", () => dialog.getByRole("button", { name: "Save Fallback" }).click());
  const auth = page.getByRole("dialog", { name: "Authorize Router Change" });
  await evidence.step("panel", "router-fallback-pin", "Authorize the Router fallback", () => auth.getByLabel("Security PIN").fill(pin), { sensitive: true });
  await evidence.step("panel", "router-fallback-authorize", "Persist the Router fallback", () => auth.getByRole("button", { name: "Authorize and save" }).click(), { sensitive: true });
  await auth.waitFor({ state: "hidden", timeout: 30_000 });
}
