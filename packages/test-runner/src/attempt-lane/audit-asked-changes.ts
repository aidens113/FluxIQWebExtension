// `node dist/attempt-lane/audit-asked-changes.js [--task <id>]... [--scenario <id>] [--out <file>]`
//
// The honest path behind the double-act oracle: each realistic task's own recording
// script, played once in a visible browser from the seeded fixture, with the site's
// lasting change read before and after. What it prints is what the task asks for, as
// the site records it, and `flow-lane/creation/site-change/asked/` must say the same
// (it is checked here for every task the script finished). It is provider-free: no
// Core, no model, and no extension; only the Scenario Lab and a browser.
//
// A task whose script does not finish is reported as such and never taken as proof.

import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { withoutProviderSecrets } from "../environment.js";
import { askedChangeOf, lastingViewOf, loadLiveInstructionTasks, resolveCreatedFlowRequest, siteChange, type LiveInstructionTask, type SiteChange, type SiteState } from "../flow-lane/index.js";
import { isRealisticScenario, type RealisticScenarioId } from "../realistic-scenarios/index.js";
import { loadScenarioManifest } from "../scenarios.js";
import { ScenarioStepRunner } from "../scenario-steps/index.js";

/** One task's honest path. */
export type AskedChangeAudit = {
  taskId: string;
  /** Tasks with the same scenario, workflow and instruction, which ask for the same change and are not played again. */
  sameAs: string[];
  /** The step the script stopped on, or `null` when it finished. */
  stoppedAt: string | null;
  stopReason: string | null;
  change: SiteChange;
  /** Whether the table says the same as the path; `null` when the path did not finish. */
  agreesWithTable: boolean | null;
};

const CONTROL_TOKEN = "asked-change-audit-token";

type RunningLab = { origin: string; close(): Promise<void> };
type LabModule = { startScenarioLab(options: { runToken: string; seed?: number }): Promise<RunningLab> };

async function control(lab: RunningLab, pathname: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${lab.origin}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${CONTROL_TOKEN}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`The fixture refused ${pathname} with ${response.status}`);
  return await response.json();
}

async function siteState(lab: RunningLab, scenarioId: string): Promise<SiteState> {
  const snapshot = await control(lab, `/__control/final-state?scenario=${encodeURIComponent(scenarioId)}`) as { state: SiteState };
  return snapshot.state;
}

/** Plays `script` on a fresh browser session of `scenario`, from the fixture's seed, and answers with what changed. */
async function playHonestPath(browser: Browser, lab: RunningLab, scenario: WebScenario, task: LiveInstructionTask, script: readonly ScenarioStep[], armVariant: { workflowId?: string } | null): Promise<Pick<AskedChangeAudit, "stoppedAt" | "stopReason" | "change">> {
  await control(lab, "/__control/seed", { seed: scenario.seed });
  if (armVariant && task.variantId) await control(lab, "/__control/arm", { scenarioId: scenario.id, variantId: task.variantId, ...armVariant });
  const view = lastingViewOf(scenario.id as RealisticScenarioId);
  const before = view(await siteState(lab, scenario.id));
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
  let stoppedAt: string | null = null;
  let stopReason: string | null = null;
  try {
    const page = await context.newPage();
    // The script begins on the page the harness opens for it, as a recording-lane run does.
    await page.goto(`${lab.origin}${scenario.startPath}`, { waitUntil: "domcontentloaded" });
    const runner = new ScenarioStepRunner({
      context, page, origin: lab.origin,
      isScenarioUrl: (url) => url.startsWith(lab.origin),
      uploadDirectory: path.join(tmpdir(), "fluxiq-asked-change-audit"),
      scriptedNavigation: async (target, url, timeoutMs) => { await target.goto(url, { waitUntil: "domcontentloaded", ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }) }); },
    });
    for (const step of script) {
      try { await runner.run(step); }
      catch (error) {
        stoppedAt = step.id;
        stopReason = error instanceof Error ? error.message.split("\n")[0]!.slice(0, 200) : String(error).slice(0, 200);
        break;
      }
    }
  } finally {
    await context.close().catch(/* best-effort: the audit's answer does not depend on closing the session */ () => undefined);
  }
  return { stoppedAt, stopReason, change: siteChange(before, view(await siteState(lab, scenario.id))) };
}

/** Plays one task per distinct scenario, workflow and instruction, in the order the catalog lists them. */
export async function auditAskedChanges(input: { scenarioLabDist: string; repositoryRoot: string; taskIds?: readonly string[]; scenarioId?: string; onResult?: (audit: AskedChangeAudit) => void }): Promise<AskedChangeAudit[]> {
  const catalog = (await loadLiveInstructionTasks(input.scenarioLabDist)).filter((task) => isRealisticScenario(task.scenarioId));
  const chosen = catalog.filter((task) => (input.taskIds?.length ? input.taskIds.includes(task.id) : true) && (input.scenarioId ? task.scenarioId === input.scenarioId : true));
  const groups = new Map<string, LiveInstructionTask[]>();
  for (const task of chosen) {
    const key = JSON.stringify([task.scenarioId, task.expectedDatasetId ?? null, task.instruction]);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  const server = await import(pathToFileURL(path.join(input.scenarioLabDist, "server.js")).href) as LabModule;
  const lab = await server.startScenarioLab({ runToken: CONTROL_TOKEN });
  const browser = await chromium.launch({ headless: false, channel: "chromium", env: withoutProviderSecrets(process.env) });
  const audits: AskedChangeAudit[] = [];
  try {
    for (const tasks of groups.values()) {
      // The unarmed member of a group plays its path; a task armed after its build is the same path on the same site.
      const task = tasks.find((candidate) => candidate.variantId === undefined || candidate.variantArmedAfterBuild) ?? tasks[0]!;
      const scenario = await loadScenarioManifest(input.repositoryRoot, task.scenarioId, input.scenarioLabDist);
      const { variantId: armedLater, variantArmedAfterBuild: _armedAfterBuild, ...unarmedFields } = task;
      const unarmed: LiveInstructionTask = task.variantArmedAfterBuild || armedLater === undefined ? unarmedFields : task;
      const request = resolveCreatedFlowRequest(scenario, unarmed);
      const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(unarmed.variantId === undefined ? {} : { variantId: unarmed.variantId }) });
      const played = await playHonestPath(browser, lab, scenario, unarmed, workflow.recordingScript, unarmed.variantId ? { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }) } : null);
      const asked = askedChangeOf(task.id);
      const audit: AskedChangeAudit = {
        taskId: task.id, sameAs: tasks.filter((other) => other !== task).map((other) => other.id),
        ...played,
        agreesWithTable: played.stoppedAt !== null || asked === undefined ? null : JSON.stringify(sorted(asked.change)) === JSON.stringify(sorted(played.change)),
      };
      audits.push(audit);
      input.onResult?.(audit);
    }
  } finally {
    await browser.close().catch(/* best-effort: the audit is already recorded */ () => undefined);
    await lab.close().catch(/* best-effort: the audit is already recorded */ () => undefined);
  }
  return audits;
}

function sorted(change: SiteChange): [string, number][] {
  return Object.entries(change).sort(([left], [right]) => left.localeCompare(right));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  const args = process.argv.slice(2);
  const options = (name: string) => args.flatMap((arg, index) => (arg === name && args[index + 1] ? [args[index + 1]!] : []));
  const out = options("--out")[0];
  const scenarioId = options("--scenario")[0];
  const audits = await auditAskedChanges({
    scenarioLabDist: path.join(repositoryRoot, "apps", "scenario-lab", "dist"), repositoryRoot,
    taskIds: options("--task"), ...(scenarioId ? { scenarioId } : {}),
    onResult: (audit) => { process.stdout.write(`${JSON.stringify(audit)}\n`); },
  });
  if (out) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(audits, null, 2));
  }
  const unfinished = audits.filter((audit) => audit.stoppedAt !== null).length;
  const disagree = audits.filter((audit) => audit.agreesWithTable === false).length;
  process.stdout.write(`${JSON.stringify({ played: audits.length, finished: audits.length - unfinished, unfinished, disagree })}\n`);
  process.exitCode = disagree > 0 ? 1 : 0;
}
