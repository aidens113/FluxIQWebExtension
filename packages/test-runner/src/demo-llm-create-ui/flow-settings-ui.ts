// Setting a Flow's LLM connection through the panel, never through the API.
// The limits a run is authorized to spend are typed into the real Settings
// form, authorized with the real PIN dialog, and then read back: a save that
// silently kept different numbers is a failure here rather than a surprise
// bill during generation.

import type { Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "../secret-keys-ui.js";
import { EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, FIRST_LIVE_CREATION_LIMITS, type CreationSettingsLimits, creationSettingsFields } from "./limits.js";
import { escapeRegExp, exactVirtualizedHierarchyObject, exactVisible, setSelect, slug, waitForEndpoint } from "./panel-interaction.js";
import { fail } from "./runner-fail.js";
import { readSanitizedSettingsSaveFailure } from "./settings-save-failure.js";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";

export async function configureFirstLiveCreationViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await configureCreationLimitsViaUi(page, flowTreeItemId, pin, evidence, FIRST_LIVE_CREATION_LIMITS);
}
export async function configureEvidenceGuidedCreationViaUi(page: Page, flowTreeItemId: string, flowName: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  return configureCreationLimitsViaUi(page, flowTreeItemId, pin, evidence, EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, flowName).then(() => undefined);
}

async function configureCreationLimitsViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder, limits: CreationSettingsLimits, exactFlowName?: string): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  if (exactFlowName) {
    await evidence.step("panel", "create-settings-flow-search", "Re-resolve the exact exploration Flow before opening Settings", () => search.fill(exactFlowName));
    const flows = hierarchy.locator(".automation-tree-item").filter({ has: page.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(exactFlowName, { exact: true }) });
    await exactVisible(flows, "the exact exploration Flow hierarchy item");
    const current = flows.first();
    await evidence.step("panel", "create-settings-flow-open", "Restore the exact exploration Flow selection", () => current.locator(".tree-row-main.type-flow").click());
    const actions = current.getByRole("button", { name: `${exactFlowName} actions`, exact: true });
    await exactVisible(actions, "the exact exploration Flow actions menu");
    await evidence.step("panel", "create-settings-flow-actions", "Open the exact exploration Flow actions", () => actions.click());
    const openSettings = page.getByRole("menuitem", { name: "Open settings", exact: true });
    await exactVisible(openSettings, "the exact exploration Flow Open settings action");
    await evidence.step("panel", "create-settings-open", "Open this Flow's Settings", () => openSettings.click());
  } else {
    await evidence.step("panel", "create-settings-search", "Search this Flow for Settings", () => search.fill("Settings"));
    const rows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-settings`, "the exact Flow Settings row");
    await evidence.step("panel", "create-settings-open", "Open this Flow's Settings", () => rows.click());
  }
  const workspace = page.locator(".automation-flow-settings-workspace");
  await workspace.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "create-settings-search-clear", "Clear hierarchy search", () => search.fill(""));
  await workspace.getByText("Loading saved Flow settings...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const section = workspace.getByRole("navigation", { name: "Flow settings sections", exact: true }).locator('button[aria-controls="flow-settings-llm"]');
  await exactVisible(section, "the LLM Connection settings section");
  await evidence.step("panel", "create-settings-section", "Open LLM Connection settings", () => section.click());
  const root = workspace.locator("#flow-settings-llm");
  await setSelect(root, "Provider", "deepseek", page, evidence);
  await setSelect(root, "Model", DEFAULT_LLM_MODEL, page, evidence);
  const key = workspace.getByRole("combobox", { name: "Encrypted API key", exact: true });
  await exactVisible(key, "the encrypted API key selector");
  if (await key.inputValue() !== TESTING_LAB_DEEPSEEK_KEY_NAME) {
    await evidence.step("panel", "create-settings-key", "Select the stored Testing Lab DeepSeek key", async () => {
      await key.fill(TESTING_LAB_DEEPSEEK_KEY_NAME);
      const option = workspace.getByRole("option", {
        name: new RegExp(`^${escapeRegExp(TESTING_LAB_DEEPSEEK_KEY_NAME)}`, "u"),
      });
      await exactVisible(option, "the stored Testing Lab DeepSeek key option");
      await option.click();
    });
  }
  if (await key.inputValue() !== TESTING_LAB_DEEPSEEK_KEY_NAME) fail("The exact stored Testing Lab DeepSeek key was not selected");
  const fields = creationSettingsFields(limits);
  for (const [label, value] of fields) {
    const input = root.getByLabel(label, { exact: true });
    await exactVisible(input, `the exact ${label} setting`);
    if (await input.inputValue() !== value) await evidence.step("panel", `create-settings-${slug(label)}`, `Set ${label}`, () => input.fill(value));
  }
  const save = workspace.getByRole("button", { name: "Save Settings", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "create-settings-save", "Request saving bounded Flow settings", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Flow Settings Save", exact: true });
    await exactVisible(dialog, "the Flow Settings authorization dialog");
    await evidence.step("panel", "create-settings-pin", "Authorize bounded Flow Settings", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    const saveResponse = await evidence.step("panel", "create-settings-authorize", "Save bounded Flow Settings", () => waitForEndpoint(page, "update-flow-settings", () => dialog.getByRole("button", { name: "Authorize and Save", exact: true }).click()), { sensitive: true });
    if (!saveResponse.ok()) {
      const failure = await readSanitizedSettingsSaveFailure(saveResponse);
      await evidence.diagnostic("panel", "settings-save-rejected", failure.code, {
        httpStatus: failure.status,
        responseBytes: failure.responseBytes,
        responseParsed: failure.parsed,
        revisionBothParsed: failure.revisionBothParsed,
        revisionExpectedLt: failure.revisionRelation === "expected_lt",
        revisionExpectedEq: failure.revisionRelation === "expected_eq",
        revisionExpectedGt: failure.revisionRelation === "expected_gt",
        revisionAbsoluteDelta: failure.revisionAbsoluteDelta ?? 0,
      });
      fail(`Flow Settings save was rejected (${failure.code})`);
    }
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
  await workspace.getByText("All Flow settings saved", { exact: true }).waitFor({ timeout: 30_000 });
  for (const [label, value] of fields) if (await root.getByLabel(label, { exact: true }).inputValue() !== value) fail("Saved LLM limits differ from the certified creation profile");
}
