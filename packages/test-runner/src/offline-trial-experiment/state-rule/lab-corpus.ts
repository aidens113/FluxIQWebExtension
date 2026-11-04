// What the Lab saved: every run's verdicts and window from its folder under
// `lab-runs/<date>/<run>/`, and the project stores its instance kept. Reads files only.
// Stores are matched to a run by the time their traces started, because a Lab workspace
// is reused and one store can hold several runs' traces.

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { jsonRecord } from "../json-record.js";
import type { LabRunRecord } from "./types.js";

const PROJECTS = path.join("fluxiq-root", ".fluxiq", "artifacts", "automation-studio", "projects");
const STEP_FILES_READ_FOR_MODEL = 80;

export async function readLabRuns(labRunsDir: string): Promise<readonly LabRunRecord[]> {
  const runs: LabRunRecord[] = [];
  for (const date of await directories(labRunsDir)) {
    for (const run of await directories(path.join(labRunsDir, date))) {
      const record = await readLabRun(path.join(labRunsDir, date, run));
      if (record !== null) runs.push(record);
    }
  }
  return Object.freeze(runs.sort((left, right) => left.startedAt.localeCompare(right.startedAt)));
}

export async function readLabRun(directory: string): Promise<LabRunRecord | null> {
  const entry = await readJson(path.join(directory, "entry.json"));
  if (entry === undefined || typeof entry.runId !== "string" || typeof entry.startedAt !== "string") return null;
  const evaluation = (await readJson(path.join(directory, "evaluation.json"))) ?? {};
  const task = typeof entry.task === "string" ? entry.task : "";
  const model = await runModel(path.join(directory, "steps"));
  return Object.freeze({
    runId: entry.runId,
    directory,
    task: task.split("/")[1] ?? task,
    scenario: typeof entry.scenarioId === "string" ? entry.scenarioId : task.split("/")[0] ?? "",
    instance: typeof entry.instance === "string" ? entry.instance : "",
    repositoryRoot: typeof entry.repositoryRoot === "string" ? entry.repositoryRoot : "",
    startedAt: entry.startedAt,
    finishedAt: typeof entry.finishedAt === "string" ? entry.finishedAt : null,
    verdict: typeof entry.verdict === "string" ? entry.verdict : "unknown",
    oracleVerdict: typeof evaluation.oracleVerdict === "string" ? evaluation.oracleVerdict : null,
    reportedVerdict: typeof evaluation.reportedVerdict === "string" ? evaluation.reportedVerdict : null,
    flowCreated: evaluation.flowCreated === true,
    facilityFailure: evaluation.facilityFailure !== null && evaluation.facilityFailure !== undefined,
    provider: model.provider,
    model: model.model,
  });
}

/** The project stores a run's instance kept on this machine. */
export async function labRunStores(run: Pick<LabRunRecord, "repositoryRoot" | "instance">): Promise<readonly string[]> {
  const workspaces = path.join(run.repositoryRoot, "test-runs", "instances", run.instance, "persistent-isolated");
  const stores: string[] = [];
  for (const workspace of await directories(workspaces)) {
    const projects = path.join(workspaces, workspace, PROJECTS);
    for (const project of await directories(projects)) {
      const store = path.join(projects, project, "project.sqlite");
      if (existsSync(store)) stores.push(store);
    }
  }
  return Object.freeze(stores);
}

/** Whether a trace that started at `startedAt` belongs to a run, by the run's window. */
export function traceInRunWindow(startedAt: string, run: Pick<LabRunRecord, "startedAt" | "finishedAt">): boolean {
  return startedAt >= run.startedAt && (run.finishedAt === null || startedAt <= run.finishedAt);
}

/** The model the run's first model steps name: the provider and model of the first step that names them. */
async function runModel(stepsDir: string): Promise<{ provider: string | null; model: string | null }> {
  const steps = [...(await directories(stepsDir))].sort().slice(0, STEP_FILES_READ_FOR_MODEL);
  for (const step of steps) {
    const meta = await readJson(path.join(stepsDir, step, "meta.json"));
    if (typeof meta?.model === "string" || typeof meta?.provider === "string") {
      return { provider: typeof meta.provider === "string" ? meta.provider : null, model: typeof meta.model === "string" ? meta.model : null };
    }
  }
  return { provider: null, model: null };
}

async function directories(directory: string): Promise<readonly string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(file: string): Promise<Record<string, unknown> | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return jsonRecord(JSON.parse(text));
}
