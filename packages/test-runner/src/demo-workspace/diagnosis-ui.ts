// The deterministic target-drift diagnosis fixture: its Flow identity and
// profile, and the panel UI that puts its instruction in place and runs it.
import type { Locator, Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { RunnerFailure } from "../failure.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "../secret-keys-ui.js";
import { exactVirtualizedHierarchyObject } from "../demo-llm-create-ui.js";
import { FIRST_LIVE_ADAPTATION_PROFILE } from "../demo-llm-adaptation.js";
import { required } from "./configuration.js";
import { assertLlmDiagnosisRecordingDerivedFlow } from "./flow-document.js";
import { waitForPanelMutationResponse, waitForPanelRunResponse } from "./panel-run.js";
import type { DemoFlowProfile } from "./provisioning.js";
import { escapeCssAttribute, escapeRegExp } from "./selectors.js";

export const LLM_DIAGNOSIS_FLOW_NAME = "Web Extension LLM Target Drift Diagnosis";

export const LLM_DIAGNOSIS_FLOW_ID = "flow.web-extension-llm-target-drift";

export const LLM_DIAGNOSIS_SUBFLOW_NAME = "Stable target deterministic baseline";

export const LLM_DIAGNOSIS_SCENARIO_PATH = "/scenarios/llm-target-drift/";

export const LLM_DIAGNOSIS_INSTRUCTION_TITLE = "Diagnose deterministic target drift";

export const LLM_DIAGNOSIS_INSTRUCTION_BODY = "Diagnose why the recorded loopback target could not be activated. Do not patch, retry, adapt, promote, or perform external side effects.";

export const LLM_DIAGNOSIS_FLOW_PROFILE: DemoFlowProfile = {
  subflowName: LLM_DIAGNOSIS_SUBFLOW_NAME,
  useSavedWorkspaceState: false,
  persistWorkspaceState: false,
  assertRecordingDerivedFlow: assertLlmDiagnosisRecordingDerivedFlow,
  renderedNodeCounts: [1, 2],
};

export async function waitForInstructionLibraryIdle(page: Page, shell: Locator, timeoutMs = 10_000): Promise<void> {
  const list = shell.locator(".automation-instruction-list");
  await list.waitFor({ state: "visible", timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await list.getAttribute("aria-busy") === "false") return;
    await page.waitForTimeout(50);
  }
  throw new RunnerFailure("runtime.behavior", "The Flow Instructions library did not become ready");
}

export async function ensureLlmDiagnosisInstructionViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const hierarchySearch = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-instruction-search", "Search the exact Flow hierarchy for Instructions", () => hierarchySearch.fill("Instructions"));
  const instructionRows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Instructions"] .tree-row-main.type-flow-object`);
  await instructionRows.first().waitFor({ state: "visible", timeout: 10_000 });
  if (await instructionRows.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow Instructions hierarchy row is unavailable");
  await evidence.step("panel", "llm-instruction-open", "Open Instructions for the exact prepared Flow", () => instructionRows.click());
  const shell = page.locator(".automation-instructions-shell");
  await shell.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "llm-instruction-hierarchy-clear", "Clear the hierarchy search after Instructions opens", () => hierarchySearch.fill(""));

  const libraryTab = shell.getByRole("tab", { name: "Library", exact: true });
  if (await libraryTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", "llm-instruction-library", "Open the Flow Instruction Library", () => libraryTab.click());
  }
  const filters = [
    ["status", shell.getByRole("combobox", { name: "Filter instructions by status", exact: true })],
    ["requirement", shell.getByRole("combobox", { name: "Filter instructions by requirement", exact: true })],
  ] as const;
  for (const [name, filter] of filters) {
    if (await filter.inputValue({ timeout: 2_000 }) !== "") {
      await evidence.step("panel", `llm-instruction-${name}-filter-reset`, `Clear the persisted Instruction ${name} filter`, () => filter.selectOption(""));
    }
  }
  const scopeFilter = shell.getByRole("combobox", { name: "Filter instructions by scope", exact: true });
  if (await scopeFilter.inputValue({ timeout: 2_000 }) !== "flow") {
    await evidence.step("panel", "llm-instruction-scope-filter", "Restrict the Instruction Library to this Flow scope", () => scopeFilter.selectOption("flow"));
  }
  const instructionSearch = shell.getByRole("searchbox", { name: "Search instructions", exact: true });
  await evidence.step("panel", "llm-instruction-title-search", "Search for the bounded diagnosis instruction", () => instructionSearch.fill(LLM_DIAGNOSIS_INSTRUCTION_TITLE));
  await page.waitForTimeout(300);
  await waitForInstructionLibraryIdle(page, shell);
  const titlePattern = new RegExp(`^${escapeRegExp(LLM_DIAGNOSIS_INSTRUCTION_TITLE)}$`);
  const matches = shell.locator(".automation-instruction-list > button").filter({
    has: page.locator(".automation-instruction-title").filter({ hasText: titlePattern }),
  }).filter({
    has: page.locator(".automation-instruction-meta").filter({ hasText: /^Flow \|/u }),
  });
  const matchCount = await matches.count();
  if (matchCount > 1) throw new RunnerFailure("runtime.behavior", "The bounded diagnosis instruction is not unique");

  if (matchCount === 1) {
    await evidence.step("panel", "llm-instruction-edit", "Open the existing bounded diagnosis instruction", () => matches.click());
  } else {
    await evidence.step("panel", "llm-instruction-create", "Create the bounded diagnosis instruction", () => shell.getByRole("button", { name: "New Instruction", exact: true }).click());
  }

  const editor = shell.locator(".automation-instruction-editor-pane:not([hidden])");
  await editor.waitFor({ state: "visible", timeout: 10_000 });
  const editorDeadline = Date.now() + 10_000;
  while (Date.now() < editorDeadline && await editor.getAttribute("aria-busy") !== "false") await page.waitForTimeout(50);
  if (await editor.getAttribute("aria-busy") !== "false") throw new RunnerFailure("runtime.behavior", "The bounded diagnosis instruction editor did not become ready");

  const title = editor.getByPlaceholder("Instruction title", { exact: true });
  if (await title.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_TITLE) {
    await evidence.step("panel", "llm-instruction-title", "Set the bounded diagnosis instruction title", () => title.fill(LLM_DIAGNOSIS_INSTRUCTION_TITLE));
  }
  const body = editor.getByPlaceholder("Tell FluxIQ what to prefer, avoid, require, or clarify for this Flow.", { exact: true });
  if (await body.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_BODY) {
    await evidence.step("panel", "llm-instruction-body", "Set the bounded diagnosis-only safety instruction", () => body.fill(LLM_DIAGNOSIS_INSTRUCTION_BODY));
  }
  const scope = editor.locator(".automation-instruction-scope-control select");
  if (await scope.inputValue() !== "flow") {
    await evidence.step("panel", "llm-instruction-scope", "Scope the bounded instruction to this Flow", () => scope.selectOption("flow"));
  }
  const required = editor.getByRole("button", { name: "Required", exact: true });
  if (await required.getAttribute("aria-pressed") !== "true") {
    await evidence.step("panel", "llm-instruction-required", "Mark the diagnosis safety instruction required", () => required.click());
  }
  const active = editor.getByRole("button", { name: "Active", exact: true });
  if (await active.getAttribute("aria-pressed") !== "true") {
    await evidence.step("panel", "llm-instruction-active", "Activate the bounded diagnosis instruction", () => active.click());
  }

  const save = editor.getByRole("button", { name: "Save Instruction", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "llm-instruction-save", "Request the bounded diagnosis instruction save", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Instruction Save", exact: true });
    await evidence.step("panel", "llm-instruction-pin", "Authorize the bounded diagnosis instruction save", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    await evidence.step("panel", "llm-instruction-authorize", "Save the bounded diagnosis instruction", () => dialog.getByRole("button", { name: "Authorize and Save", exact: true }).click(), { sensitive: true });
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    await editor.getByText("All changes saved", { exact: true }).waitFor({ timeout: 30_000 });
  }

  if (await title.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_TITLE
    || await body.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_BODY
    || await scope.inputValue() !== "flow"
    || await required.getAttribute("aria-pressed") !== "true"
    || await active.getAttribute("aria-pressed") !== "true") {
    throw new RunnerFailure("runtime.behavior", "The bounded diagnosis instruction was not saved as an active Flow instruction");
  }
  await evidence.step("panel", "llm-instruction-library-verify", "Return to the Library to verify the saved active Flow instruction", () => libraryTab.click());
  await page.waitForTimeout(300);
  await waitForInstructionLibraryIdle(page, shell);
  const verifiedMatches = shell.locator(".automation-instruction-list > button").filter({
    has: page.locator(".automation-instruction-title").filter({ hasText: titlePattern }),
  }).filter({
    has: page.locator(".automation-instruction-meta").filter({ hasText: /^Flow \|/u }),
  });
  if (await verifiedMatches.count() !== 1
    || await verifiedMatches.locator('.status-badge-pill[title="active"]').count() !== 1
    || await verifiedMatches.getByText("required", { exact: true }).count() !== 1) {
    throw new RunnerFailure("runtime.behavior", "The Instruction Library did not confirm one active required Flow instruction");
  }
  await evidence.diagnostic("panel", "llm-instruction-ready", "llm-instruction.ready", {
    unique: true,
    active: true,
    flowScoped: true,
    required: true,
  });
}

export async function configureFirstLiveDiagnosisViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder, maxCalls = "1"): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-settings-search", "Search the exact Flow hierarchy for Settings", () => search.fill("Settings"));
  const settingsRows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-settings`, "the exact Flow Settings row");
  await evidence.step("panel", "llm-settings-open", "Open Settings for the exact prepared Flow", () => settingsRows.click());
  const workspace = page.locator(".automation-flow-settings-workspace");
  await workspace.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "llm-settings-search-clear", "Clear the hierarchy search after Settings opens", () => search.fill(""));
  await workspace.getByText("Loading saved Flow settings...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const settingsNavigation = workspace.getByRole("navigation", { name: "Flow settings sections", exact: true });
  const runtimeSectionButton = settingsNavigation.locator('button[aria-controls="flow-settings-runtime"]');
  await runtimeSectionButton.waitFor({ state: "visible", timeout: 10_000 });
  await evidence.step("panel", "adaptation-settings-section", "Open the Runtime Mode settings section", () => runtimeSectionButton.click());
  const manualApproval = workspace.locator("#flow-settings-runtime").getByRole("button", { name: /Manual approval/u });
  await manualApproval.waitFor({ state: "visible", timeout: 10_000 });
  if (await manualApproval.getAttribute("aria-pressed") !== "true") {
    await evidence.step("panel", "adaptation-settings-manual", "Enable manual-review adaptation proposals", () => manualApproval.click());
  }
  const sectionButton = settingsNavigation.locator('button[aria-controls="flow-settings-llm"]');
  await sectionButton.waitFor({ state: "visible", timeout: 10_000 });
  if (await sectionButton.count() !== 1) throw new RunnerFailure("runtime.behavior", "The LLM Connection settings section is unavailable");
  await evidence.step("panel", "llm-settings-section", "Open the LLM Connection settings section", () => sectionButton.click());
  const sectionDeadline = Date.now() + 2_000;
  while (Date.now() < sectionDeadline && await sectionButton.getAttribute("aria-current") !== "location") await page.waitForTimeout(50);
  if (await sectionButton.getAttribute("aria-current") !== "location") throw new RunnerFailure("runtime.behavior", "The LLM Connection settings section did not become active");
  const llmSection = workspace.locator("#flow-settings-llm");
  const provider = llmSection.getByLabel("Provider", { exact: true });
  await provider.waitFor({ state: "visible", timeout: 10_000 });
  if (await provider.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact LLM Provider field is unavailable");
  await evidence.step("panel", "llm-settings-provider", "Select DeepSeek", () => provider.selectOption("deepseek"));
  const model = llmSection.getByLabel("Model", { exact: true });
  if (await model.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact LLM Model field is unavailable");
  await evidence.step("panel", "llm-settings-model", "Select deepseek-chat", () => model.selectOption("deepseek-chat"));
  await evidence.step("panel", "llm-settings-key", "Select the opaque Testing Lab DeepSeek key summary", async () => {
    const key = workspace.getByRole("combobox", { name: "Encrypted API key", exact: true });
    await key.fill(TESTING_LAB_DEEPSEEK_KEY_NAME);
    await workspace.getByRole("option", { name: new RegExp("^" + escapeRegExp(TESTING_LAB_DEEPSEEK_KEY_NAME)) }).click();
  });
  const tokenValues = maxCalls === "2"
    ? [String(FIRST_LIVE_ADAPTATION_PROFILE.budget.maxInputTokens), String(FIRST_LIVE_ADAPTATION_PROFILE.budget.maxOutputTokens), String(FIRST_LIVE_ADAPTATION_PROFILE.budget.maxTotalTokensPerRequest)] as const
    : ["2000", "512", "3000"] as const;
  for (const [label, value] of [["Input tokens", tokenValues[0]], ["Output tokens", tokenValues[1]], ["Total tokens", tokenValues[2]], ["Max calls", maxCalls], ["Timeout (seconds)", "20"], ["Max cost (USD)", "0.25"], ["Provider retries", "0"]] as const) {
    const input = llmSection.getByLabel(label, { exact: true });
    if (await input.count() !== 1) throw new RunnerFailure("runtime.behavior", "An exact bounded LLM setting field is unavailable");
    await evidence.step("panel", "llm-settings-" + label.toLowerCase().replace(/[^a-z]+/gu, "-"), `Set ${label} to its first-live bound`, () => input.fill(value));
  }
  const save = workspace.getByRole("button", { name: "Save Settings", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "llm-settings-save", "Request the bounded Flow Settings save", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Flow Settings Save" });
    await evidence.step("panel", "llm-settings-pin", "Authorize the bounded Flow Settings save", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    const response = await evidence.step("panel", "llm-settings-authorize", "Save the bounded Flow Settings", () => (
      waitForPanelMutationResponse(page, "/api/programs/automation-studio/update-flow-settings", () => dialog.getByRole("button", { name: "Authorize and Save" }).click())
    ), { sensitive: true });
    if (!response.ok()) throw new RunnerFailure("runtime.behavior", "The bounded Flow Settings save was rejected");
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
  await workspace.getByText("All Flow settings saved", { exact: true }).waitFor({ timeout: 30_000 });
}

export async function runDiagnosisFromPanel(page: Page, flowTreeItemId: string, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string }> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-runtime-search", "Search the exact Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Runtime Debug"] .tree-row-main.type-flow-object`);
  await runtimeRows.first().waitFor({ timeout: 10_000 });
  if (await runtimeRows.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow Runtime Debug row is unavailable");
  await evidence.step("panel", "llm-runtime-open", "Open Runtime Debug for the exact prepared Flow", () => runtimeRows.click());
  const runCommand = page.locator(".automation-runtime-run-command");
  await runCommand.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "llm-runtime-search-clear", "Clear the hierarchy search after Runtime Debug opens", () => search.fill(""));
  await page.getByText("Checking Flow readiness...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const runButton = runCommand.getByRole("button", { name: "Run", exact: true });
  const initialRunEnabled = await runButton.isEnabled({ timeout: 2_000 });
  if (!initialRunEnabled) {
    const missingActiveInstruction = await page.getByText("Add at least one active instruction.", { exact: false }).isVisible({ timeout: 2_000 }).catch(() => false);
    await evidence.diagnostic("panel", "llm-runtime-not-ready", "llm-runtime.readiness", { runEnabled: false, missingActiveInstruction });
    throw new RunnerFailure("runtime.behavior", "The prepared Flow is not ready for an authorized diagnosis-only run");
  }
  await evidence.step("panel", "llm-runtime-mode", "Select diagnosis_only mode", () => runCommand.getByRole("button", { name: "LLM diagnosis", exact: true }).click());
  if (!await runButton.isEnabled({ timeout: 2_000 })) {
    await evidence.diagnostic("panel", "llm-runtime-mode-not-ready", "llm-runtime.mode-readiness", { runEnabled: false, missingActiveInstruction: false });
    throw new RunnerFailure("runtime.behavior", "Diagnosis-only mode did not remain ready to run");
  }
  const response = await evidence.step("panel", "llm-runtime-run-request", "Start exactly one diagnosis-only run with the authenticated session", () => waitForPanelRunResponse(page, () => runButton.click()));
  const body = await response.json() as any;
  const runId = body?.payload?.runtimeSession?.runId;
  if (!response.ok() || typeof runId !== "string") throw new RunnerFailure("runtime.behavior", "The authenticated diagnosis-only run failed to return a bounded run identity");
  return { runId, status: String(body?.payload?.runtimeSession?.status ?? "unknown") };
}

export async function restoreDiagnosisScenario(page: Page, evidence: BrowserEvidenceRecorder, purpose: string): Promise<void> {
  await evidence.step("scenario", `llm-restore-${purpose}`, "Restore the target-drift fixture to its deterministic baseline", () => page.getByTestId("restore-target").click());
  await page.getByTestId("drift-mode").filter({ hasText: "Mode: baseline" }).waitFor();
  await page.getByTestId("result").filter({ hasText: "Ready" }).waitFor();
  await page.getByTestId("diagnosis-target").waitFor();
}
