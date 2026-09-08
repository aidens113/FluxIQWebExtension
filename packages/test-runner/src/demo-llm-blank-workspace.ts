import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "./browser-evidence.js";
import type { ExistingFlowSummary, ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { RunnerFailure } from "./failure.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

export const BLANK_LLM_FLOW_NAME = "Web Extension LLM Instruction Only Builder";
export const BLANK_LLM_SCENARIO_PATH = "/scenarios/instruction-only-form/";
export const BLANK_LLM_INSTRUCTION_TITLE = "Build the instruction-only form automation";
export const BLANK_LLM_INSTRUCTION_BODY = "Using the connected browser page, enter Ada in Name, choose Team for Plan, submit the form, and verify the result says Submitted: Ada / team. Build an owned Subflow and route this Flow to it. Do not use recordings or external side effects.";
const BLANK_LLM_STATE_SCHEMA_VERSION = "0.1" as const;

export type BlankLlmPreparationState = Readonly<{
  schemaVersion: typeof BLANK_LLM_STATE_SCHEMA_VERSION;
  projectId: string;
  flowId: string;
}>;

export type BlankLlmPreparationConfig = Readonly<{
  workspaceDirectory: string;
  origin: string;
  projectId?: string;
  projectName: string;
  pin: string;
}>;

export function parseBlankLlmPreparationState(value: unknown): BlankLlmPreparationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Blank LLM preparation state must be an object");
  const record = value as Record<string, unknown>;
  const allowed = ["schemaVersion", "projectId", "flowId"];
  if (record.schemaVersion !== BLANK_LLM_STATE_SCHEMA_VERSION || Object.keys(record).some(key => !allowed.includes(key))) throw new Error("Blank LLM preparation state has an unsupported schema");
  for (const field of allowed.slice(1)) {
    if (typeof record[field] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(record[field] as string)) throw new Error(`Blank LLM preparation state is missing or has an invalid ${field}`);
  }
  return Object.freeze(record as BlankLlmPreparationState);
}

export function assertBlankLlmPreparationStateDoesNotContainSecrets(state: BlankLlmPreparationState, secrets: readonly string[]): void {
  const serialized = JSON.stringify(state);
  if (secrets.some(secret => secret.length > 0 && serialized.includes(secret))) throw new Error("Blank LLM preparation metadata contains credential material");
}

export async function loadBlankLlmPreparationState(workspaceDirectory: string): Promise<BlankLlmPreparationState | undefined> {
  try {
    return parseBlankLlmPreparationState(JSON.parse(await readFile(blankStatePath(workspaceDirectory), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function saveBlankLlmPreparationState(workspaceDirectory: string, state: BlankLlmPreparationState, secrets: readonly string[]): Promise<void> {
  assertBlankLlmPreparationStateDoesNotContainSecrets(state, secrets);
  const target = blankStatePath(workspaceDirectory);
  const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

export async function prepareBlankLlmFlowViaUi(input: {
  control: ExistingFluxIQControlClient;
  config: BlankLlmPreparationConfig;
  page: Page;
  evidence: BrowserEvidenceRecorder;
  saved?: BlankLlmPreparationState;
}): Promise<{ state: BlankLlmPreparationState; recordingIdsBefore: ReadonlySet<string>; flowTreeItemId: string }> {
  const { control, config, page, evidence, saved } = input;
  const projects = await control.listProjects("web-automation");
  const requestedProjectId = saved?.projectId ?? config.projectId;
  let project = requestedProjectId ? projects.find(item => item.id === requestedProjectId) : undefined;
  if (requestedProjectId && !project) throw new RunnerFailure("environment.missing", "Configured blank-Flow project is not accessible");
  if (!project) {
    const named = projects.filter(item => item.name === config.projectName && item.domainId === "web-automation");
    if (named.length > 1) throw new RunnerFailure("environment.missing", "More than one matching blank-Flow project exists");
    project = named[0];
  }
  if (!project) {
    await openAutomationStudio(page, config.origin, evidence);
    await evidence.step("panel", "blank-project-create-open", "Open the Create project dialog", () => page.getByRole("button", { name: "Project", exact: true }).click());
    const dialog = page.getByRole("dialog", { name: "Create project" });
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    await evidence.step("panel", "blank-project-name", "Enter the instruction-only project name", () => dialog.getByLabel("Project name", { exact: true }).fill(config.projectName));
    await evidence.step("panel", "blank-project-description", "Describe the instruction-only testing workspace", () => dialog.getByLabel("Description", { exact: true }).fill("Persistent instruction-only LLM browser automation test workspace"));
    await evidence.step("panel", "blank-project-pin", "Authorize instruction-only project creation", () => dialog.getByLabel("Security PIN", { exact: true }).fill(config.pin), { sensitive: true });
    await evidence.step("panel", "blank-project-create-submit", "Create the instruction-only project", () => dialog.getByRole("button", { name: "Create project", exact: true }).click(), { sensitive: true });
    const created = (await control.listProjects("web-automation")).filter(item => item.name === config.projectName);
    if (created.length !== 1) throw new RunnerFailure("environment.missing", "Panel project creation did not produce one web-automation project");
    project = created[0]!;
  }
  if (project.domainId !== "web-automation") throw new RunnerFailure("environment.missing", "Instruction-only project must use the web-automation domain");

  await openProject(page, config.origin, project.name, evidence);
  const recordingIdsBefore = recordingIds(await control.listRecordings(project.id));
  const summaries = await control.listFlowSummaries(project.id);
  let summary = saved ? summaries.find(item => item.flowId === saved.flowId) : undefined;
  if (saved && !summary) throw new RunnerFailure("environment.missing", "Saved blank Flow is no longer accessible");
  if (!summary) {
    const named = summaries.filter(item => item.name === BLANK_LLM_FLOW_NAME);
    if (named.length > 1) throw new RunnerFailure("environment.missing", "More than one instruction-only blank Flow exists");
    summary = named[0];
  }
  if (!summary) {
    await evidence.step("panel", "blank-flow-create-open", "Open the Add Flow dialog", () => page.getByRole("button", { name: "Add Flow", exact: true }).click());
    const chooser = page.getByRole("dialog");
    await evidence.step("panel", "blank-flow-create-kind", "Choose a Flow hierarchy item", () => chooser.getByRole("button", { name: /^Flow/u }).click());
    const form = page.getByRole("dialog");
    const name = await hierarchyDialogFieldControl(form, "Name", "input");
    const preset = await hierarchyDialogFieldControl(form, "Flow preset", "select");
    const location = await hierarchyDialogFieldControl(form, "Location", "select");
    const pin = await hierarchyDialogFieldControl(form, "Security PIN", "input");
    await evidence.step("panel", "blank-flow-create-name", "Name the instruction-only blank Flow", () => name.fill(BLANK_LLM_FLOW_NAME));
    if (await preset.inputValue() !== "blank") await evidence.step("panel", "blank-flow-create-preset", "Choose the blank visual Flow preset", () => preset.selectOption("blank"));
    if (await location.inputValue() !== "") throw new RunnerFailure("runtime.behavior", "Blank top-level Flow creation opened outside the Flow root");
    await evidence.step("panel", "blank-flow-create-pin", "Authorize blank Flow creation", () => pin.fill(config.pin), { sensitive: true });
    await evidence.step("panel", "blank-flow-create-submit", "Create the blank Flow", () => form.getByRole("button", { name: "Create", exact: true }).click(), { sensitive: true });
    summary = await waitForNamedFlow(control, project.id, BLANK_LLM_FLOW_NAME);
    if (!await hierarchyRow(page, BLANK_LLM_FLOW_NAME).isVisible().catch(() => false)) {
      await evidence.step("panel", "blank-flow-create-refresh", "Refresh the panel after blank Flow creation", () => page.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
      await page.locator(".automation-studio-sidebar-heading").getByText(project.name, { exact: true }).waitFor();
    }
  }

  if (!summary) throw new RunnerFailure("environment.missing", "Instruction-only blank Flow identity is unavailable");
  const state = Object.freeze({ schemaVersion: BLANK_LLM_STATE_SCHEMA_VERSION, projectId: project.id, flowId: summary.flowId });
  await assertGenuinelyBlankFlow(control, state);
  const flowTreeItemId = await openFlow(page, BLANK_LLM_FLOW_NAME, evidence);
  await ensureInstruction(page, flowTreeItemId, config.pin, evidence);
  await assertGenuinelyBlankFlow(control, state);
  return { state, recordingIdsBefore, flowTreeItemId };
}

export async function assertGenuinelyBlankFlow(control: ExistingFluxIQControlClient, state: BlankLlmPreparationState): Promise<void> {
  const flow = await control.getExactFlow(state.projectId, state.flowId);
  const metadata = flow.document.metadata as Record<string, unknown> | undefined;
  if (!Array.isArray(flow.document.nodes) || flow.document.nodes.length !== 0
    || !Array.isArray(flow.document.edges) || flow.document.edges.length !== 0
    || metadata?.flowRepresentationKind !== "orchestration"
    || metadata?.lastRecordingId !== undefined
    || metadata?.subflowGraph !== undefined
    || metadata?.parentFlowId !== undefined
    || metadata?.parentSubflowId !== undefined) {
    throw new RunnerFailure("environment.missing", "Instruction-only Flow is not a genuinely blank orchestration Flow");
  }
  if ((await control.listFlowSubflows(state.projectId, state.flowId)).length !== 0) throw new RunnerFailure("environment.missing", "Instruction-only blank Flow already owns a Subflow");
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (router?.fallback?.kind === "subflow" || router?.fallback?.subflowId || router?.rules.some(rule => rule.target?.kind === "subflow" || rule.target?.subflowId)) {
    throw new RunnerFailure("environment.missing", "Instruction-only blank Flow already has a Router Subflow route");
  }
}

export function assertRecordingSetUnchanged(before: ReadonlySet<string>, afterResponse: unknown): void {
  const after = recordingIds(afterResponse);
  if (before.size !== after.size || [...before].some(id => !after.has(id))) throw new RunnerFailure("recording.persistence", "Instruction-only preparation changed project recordings");
}

function recordingIds(response: unknown): Set<string> {
  if (!response || typeof response !== "object") return new Set();
  const record = response as Record<string, unknown>;
  const payload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : record;
  const values = payload.recordings ?? payload.items ?? payload;
  return new Set(Array.isArray(values) ? values.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const id = (item as Record<string, unknown>).recordingId ?? (item as Record<string, unknown>).id;
    return typeof id === "string" ? [id] : [];
  }) : []);
}

async function ensureInstruction(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const hierarchySearch = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "blank-instruction-search", "Search the blank Flow hierarchy for Instructions", () => hierarchySearch.fill("Instructions"));
  const rows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Instructions"] .tree-row-main.type-flow-object`);
  await rows.first().waitFor({ state: "visible", timeout: 10_000 });
  if (await rows.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact blank Flow Instructions row is unavailable");
  await evidence.step("panel", "blank-instruction-open", "Open Instructions for the blank Flow", () => rows.click());
  const shell = page.locator(".automation-instructions-shell");
  await shell.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "blank-instruction-hierarchy-clear", "Clear hierarchy search after Instructions opens", () => hierarchySearch.fill(""));
  const library = shell.getByRole("tab", { name: "Library", exact: true });
  if (await library.getAttribute("aria-selected") !== "true") await evidence.step("panel", "blank-instruction-library", "Open the Instruction Library", () => library.click());
  for (const [name, filter] of [["status", shell.getByRole("combobox", { name: "Filter instructions by status", exact: true })], ["requirement", shell.getByRole("combobox", { name: "Filter instructions by requirement", exact: true })]] as const) {
    if (await filter.inputValue() !== "") await evidence.step("panel", `blank-instruction-${name}-reset`, `Clear the Instruction ${name} filter`, () => filter.selectOption(""));
  }
  const scopeFilter = shell.getByRole("combobox", { name: "Filter instructions by scope", exact: true });
  if (await scopeFilter.inputValue() !== "flow") await evidence.step("panel", "blank-instruction-scope-filter", "Restrict Instructions to Flow scope", () => scopeFilter.selectOption("flow"));
  const search = shell.getByRole("searchbox", { name: "Search instructions", exact: true });
  await evidence.step("panel", "blank-instruction-title-search", "Search for the instruction-only guidance", () => search.fill(BLANK_LLM_INSTRUCTION_TITLE));
  await page.waitForTimeout(300);
  await waitForInstructionLibraryIdle(page, shell);
  const matches = shell.locator(".automation-instruction-list > button").filter({ has: page.locator(".automation-instruction-title").filter({ hasText: new RegExp(`^${escapeRegExp(BLANK_LLM_INSTRUCTION_TITLE)}$`) }) }).filter({ has: page.locator(".automation-instruction-meta").filter({ hasText: /^Flow \|/u }) });
  const count = await matches.count();
  if (count > 1) throw new RunnerFailure("runtime.behavior", "Instruction-only Flow guidance is not unique");
  await evidence.step("panel", count === 1 ? "blank-instruction-edit" : "blank-instruction-create", count === 1 ? "Open the existing instruction-only guidance" : "Create instruction-only guidance", () => count === 1 ? matches.click() : shell.getByRole("button", { name: "New Instruction", exact: true }).click());
  const editor = shell.locator(".automation-instruction-editor-pane:not([hidden])");
  await editor.waitFor({ state: "visible", timeout: 10_000 });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && await editor.getAttribute("aria-busy") !== "false") await page.waitForTimeout(50);
  if (await editor.getAttribute("aria-busy") !== "false") throw new RunnerFailure("runtime.behavior", "Instruction-only editor did not become ready");
  const title = editor.getByPlaceholder("Instruction title", { exact: true });
  const body = editor.getByLabel("Instruction", { exact: true });
  if (await title.inputValue() !== BLANK_LLM_INSTRUCTION_TITLE) await evidence.step("panel", "blank-instruction-title", "Set the instruction-only title", () => title.fill(BLANK_LLM_INSTRUCTION_TITLE));
  if (await body.inputValue() !== BLANK_LLM_INSTRUCTION_BODY) await evidence.step("panel", "blank-instruction-body", "Set the bounded instruction-only goal", () => body.fill(BLANK_LLM_INSTRUCTION_BODY));
  const scope = editor.getByLabel("Scope", { exact: true });
  if (await scope.inputValue() !== "flow") await evidence.step("panel", "blank-instruction-scope", "Scope the guidance to this Flow", () => scope.selectOption("flow"));
  const required = editor.getByRole("button", { name: "Required", exact: true });
  if (await required.getAttribute("aria-pressed") !== "true") await evidence.step("panel", "blank-instruction-required", "Mark instruction-only guidance required", () => required.click());
  const active = editor.getByRole("button", { name: "Active", exact: true });
  if (await active.getAttribute("aria-pressed") !== "true") await evidence.step("panel", "blank-instruction-active", "Activate instruction-only guidance", () => active.click());
  const save = editor.getByRole("button", { name: "Save Instruction", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "blank-instruction-save", "Request saving instruction-only guidance", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Instruction Save", exact: true });
    await evidence.step("panel", "blank-instruction-pin", "Authorize instruction-only guidance", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    await evidence.step("panel", "blank-instruction-authorize", "Save instruction-only guidance", () => dialog.getByRole("button", { name: "Authorize and Save", exact: true }).click(), { sensitive: true });
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    await editor.getByText("All changes saved", { exact: true }).waitFor({ timeout: 30_000 });
  }
  if (await title.inputValue() !== BLANK_LLM_INSTRUCTION_TITLE || await body.inputValue() !== BLANK_LLM_INSTRUCTION_BODY || await scope.inputValue() !== "flow" || await required.getAttribute("aria-pressed") !== "true" || await active.getAttribute("aria-pressed") !== "true") {
    throw new RunnerFailure("runtime.behavior", "Instruction-only guidance was not saved active and required at Flow scope");
  }
}

async function openAutomationStudio(page: Page, origin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await evidence.step("panel", "blank-studio-open", "Open Automation Studio in the Web Automation domain", () => page.goto(`${origin}/programs/automation-studio?domainId=web-automation`, { waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
}

async function openProject(page: Page, origin: string, projectName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await openAutomationStudio(page, origin, evidence);
  await evidence.step("panel", "blank-project-search", "Search for the instruction-only project", () => page.getByLabel("Search projects").fill(projectName));
  const row = page.locator(".automation-project-row").filter({ hasText: projectName }).first();
  await evidence.step("panel", "blank-project-open", "Open the instruction-only project", () => row.locator(".automation-project-row-main").click());
  await page.locator(".automation-studio-sidebar-heading").getByText(projectName, { exact: true }).waitFor();
}

async function openFlow(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<string> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
  if (await typeFilter.inputValue() !== "all") await evidence.step("panel", "blank-flow-type-reset", "Reset the hierarchy object filter", () => typeFilter.selectOption("all"));
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "blank-flow-search", "Search for the instruction-only blank Flow", () => search.fill(flowName));
  const items = page.locator('.automation-tree-item').filter({ has: page.locator('.tree-row-main.type-flow .tree-row-label > strong').getByText(flowName, { exact: true }) });
  await items.first().waitFor({ timeout: 10_000 });
  if (await items.count() !== 1) throw new RunnerFailure("runtime.behavior", "Instruction-only blank Flow hierarchy identity is ambiguous");
  const item = items.first();
  await evidence.step("panel", "blank-flow-open", "Open the instruction-only blank Flow", () => item.locator(".tree-row-main.type-flow").click());
  const id = await item.getAttribute("data-tree-item-id");
  if (!id) throw new RunnerFailure("runtime.behavior", "Instruction-only blank Flow hierarchy identity is unavailable");
  if (await item.getAttribute("aria-expanded") === "false") await evidence.step("panel", "blank-flow-expand", "Expand the instruction-only blank Flow", () => item.getByRole("button", { name: `Expand ${flowName}` }).click());
  await evidence.step("panel", "blank-flow-search-clear", "Clear the Flow hierarchy search", () => search.fill(""));
  return id;
}

function hierarchyRow(page: Page, label: string): Locator {
  return page.locator(".tree-row-main").filter({ hasText: new RegExp("^" + escapeRegExp(label)) }).first();
}

export async function hierarchyDialogFieldControl(form: Locator, label: string, control: "input" | "select"): Promise<Locator> {
  const fields = form.locator("label.field").filter({ hasText: new RegExp("^" + escapeRegExp(label)) });
  const matches = fields.locator(`:scope > ${control}`);
  if (await matches.count() !== 1 || !await matches.isVisible().catch(() => false)) {
    throw new RunnerFailure("runtime.behavior", "The exact visible hierarchy dialog field control is unavailable");
  }
  return matches;
}

async function waitForNamedFlow(control: ExistingFluxIQControlClient, projectId: string, name: string): Promise<ExistingFlowSummary> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const matches = (await control.listFlowSummaries(projectId)).filter(item => item.name === name);
    if (matches.length > 1) throw new RunnerFailure("environment.missing", "Panel created more than one instruction-only Flow");
    if (matches.length === 1) return matches[0]!;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("environment.missing", "Panel blank Flow creation did not persist");
}

async function waitForInstructionLibraryIdle(page: Page, shell: Locator): Promise<void> {
  const list = shell.locator(".automation-instruction-list");
  await list.waitFor({ state: "visible", timeout: 10_000 });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await list.getAttribute("aria-busy") === "false") return;
    await page.waitForTimeout(50);
  }
  throw new RunnerFailure("runtime.behavior", "Instruction-only Flow library did not become ready");
}

function blankStatePath(workspaceDirectory: string): string {
  return path.join(workspaceDirectory, "llm-blank-flow-workspace.json");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function escapeCssAttribute(value: string): string {
  return value.replace(/["\\]/gu, match => `\\${match}`);
}
