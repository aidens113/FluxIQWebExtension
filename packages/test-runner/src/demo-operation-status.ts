import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { RunnerFailure, type RunnerFailureCategory } from "./failure.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

const STATUS_SCHEMA_VERSION = "0.1" as const;
const STATUS_FILE_NAME = "demo-llm-prepare-status.json";
const MAX_STATUS_BYTES = 4_096;

export const demoLlmPreparationPhases = [
  "workspace-locked",
  "core-ready",
  "auth-call",
  "auth-returned",
  "browser-call",
  "scenario-ready",
  "browser-ready",
  "browser-operation-call",
  "operation-entered",
  "flow-open-call",
  "flow-open-returned",
  "instruction-ensure-call",
  "instruction-ensure-returned",
  "connect-diagnostic-call",
  "connect-diagnostic-returned",
  "connect-extension-call",
  "connect-extension-returned",
  "browser-operation-returned",
  "evidence-finalize-call",
  "evidence-finalize-returned",
  "complete",
] as const;

export type DemoLlmPreparationPhase = typeof demoLlmPreparationPhases[number];
export type DemoLlmPreparationFailureClass = "none" | "runner" | "node-io" | "playwright-timeout" | "error" | "unknown";
export type DemoLlmPreparationStatus = {
  schemaVersion: typeof STATUS_SCHEMA_VERSION;
  operation: "demo-llm-prepare";
  outcome: "passed" | "failed";
  phase: DemoLlmPreparationPhase;
  phaseIndex: number;
  failureClass: DemoLlmPreparationFailureClass;
  failureCode: string;
  sourceLocation?: string;
};

const nodeFailureCodes = new Set([
  "EACCES", "EPERM", "EBUSY", "ENOENT", "EEXIST", "ENOTEMPTY",
  "EADDRINUSE", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
]);
const runnerFailureCodes = new Set<RunnerFailureCategory>([
  "environment.missing", "process.startup", "gateway.connection", "gateway.pairing",
  "recording.contract", "recording.persistence", "action.dispatch", "runtime.behavior",
  "test.flaky", "unknown",
]);
const failureClasses = new Set<DemoLlmPreparationFailureClass>(["none", "runner", "node-io", "playwright-timeout", "error", "unknown"]);
const sourceLocationPattern = /^(?:demo-workspace|browser-evidence|bundle|capture):[1-9][0-9]{0,5}:[1-9][0-9]{0,4}$/u;

export class DemoLlmPreparationPhaseTracker {
  private phase: DemoLlmPreparationPhase = "workspace-locked";
  private failure: Pick<DemoLlmPreparationStatus, "failureClass" | "failureCode" | "sourceLocation"> | undefined;

  set(phase: DemoLlmPreparationPhase): void {
    if (this.failure) return;
    this.phase = phase;
  }

  captureFailure(error: unknown): void {
    if (this.failure) return;
    this.failure = sanitizeFailure(error);
  }

  status(outcome: "passed" | "failed"): DemoLlmPreparationStatus {
    const phase = outcome === "passed" ? "complete" : this.phase;
    const failure = outcome === "passed"
      ? { failureClass: "none" as const, failureCode: "none" as const }
      : this.failure ?? { failureClass: "unknown" as const, failureCode: "unknown" as const };
    return parseDemoLlmPreparationStatus({
      schemaVersion: STATUS_SCHEMA_VERSION,
      operation: "demo-llm-prepare",
      outcome,
      phase,
      phaseIndex: demoLlmPreparationPhases.indexOf(phase),
      ...failure,
    });
  }
}

export function sanitizeDemoLlmPreparationFailure(phase: DemoLlmPreparationPhase, error: unknown): DemoLlmPreparationStatus {
  const tracker = new DemoLlmPreparationPhaseTracker();
  tracker.set(phase);
  tracker.captureFailure(error);
  return tracker.status("failed");
}

export function parseDemoLlmPreparationStatus(value: unknown): DemoLlmPreparationStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Demo LLM preparation status is invalid");
  const record = value as Record<string, unknown>;
  const allowed = ["schemaVersion", "operation", "outcome", "phase", "phaseIndex", "failureClass", "failureCode", "sourceLocation"];
  if (Object.keys(record).some(key => !allowed.includes(key))
    || record.schemaVersion !== STATUS_SCHEMA_VERSION
    || record.operation !== "demo-llm-prepare"
    || (record.outcome !== "passed" && record.outcome !== "failed")
    || !demoLlmPreparationPhases.includes(record.phase as DemoLlmPreparationPhase)
    || record.phaseIndex !== demoLlmPreparationPhases.indexOf(record.phase as DemoLlmPreparationPhase)
    || !failureClasses.has(record.failureClass as DemoLlmPreparationFailureClass)
    || typeof record.failureCode !== "string"
    || !validFailureCode(record.failureClass as DemoLlmPreparationFailureClass, record.failureCode)
    || (record.sourceLocation !== undefined && (typeof record.sourceLocation !== "string" || !sourceLocationPattern.test(record.sourceLocation)))
    || (record.outcome === "passed" && (record.phase !== "complete" || record.failureClass !== "none" || record.failureCode !== "none" || record.sourceLocation !== undefined))
    || (record.outcome === "failed" && (record.failureClass === "none" || record.failureCode === "none"))) {
    throw new Error("Demo LLM preparation status is invalid");
  }
  return record as DemoLlmPreparationStatus;
}

export async function writeDemoLlmPreparationStatus(workspaceDirectory: string, status: DemoLlmPreparationStatus): Promise<void> {
  const parsed = parseDemoLlmPreparationStatus(status);
  await mkdir(workspaceDirectory, { recursive: true, mode: 0o700 });
  const target = demoLlmPreparationStatusPath(workspaceDirectory);
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, JSON.stringify(parsed, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

export async function readDemoLlmPreparationStatus(workspaceDirectory: string): Promise<DemoLlmPreparationStatus> {
  const target = demoLlmPreparationStatusPath(workspaceDirectory);
  const metadata = await stat(target);
  if (!metadata.isFile() || metadata.size > MAX_STATUS_BYTES) throw new Error("Demo LLM preparation status is invalid");
  return parseDemoLlmPreparationStatus(JSON.parse(await readFile(target, "utf8")));
}

function demoLlmPreparationStatusPath(workspaceDirectory: string): string {
  return path.join(path.resolve(workspaceDirectory), STATUS_FILE_NAME);
}

function sanitizeFailure(error: unknown): Pick<DemoLlmPreparationStatus, "failureClass" | "failureCode" | "sourceLocation"> {
  let failureClass: DemoLlmPreparationFailureClass = "unknown";
  let failureCode = "unknown";
  if (error instanceof RunnerFailure) {
    failureClass = "runner";
    failureCode = error.category;
  } else {
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
    const name = typeof error === "object" && error !== null && "name" in error && typeof error.name === "string" ? error.name : undefined;
    if (code && nodeFailureCodes.has(code)) {
      failureClass = "node-io";
      failureCode = `node.${code.toLowerCase()}`;
    } else if (name === "TimeoutError") {
      failureClass = "playwright-timeout";
      failureCode = "playwright.timeout";
    } else if (error instanceof Error) {
      failureClass = "error";
      failureCode = "error.unknown";
    }
  }
  const sourceLocation = sanitizedSourceLocation(error);
  return { failureClass, failureCode, ...(sourceLocation ? { sourceLocation } : {}) };
}

function sanitizedSourceLocation(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.stack !== "string") return undefined;
  const match = error.stack.match(/[\\/](demo-workspace|browser-evidence|bundle|capture)\.(?:js|ts):(\d{1,6}):(\d{1,5})(?:\)?$|[\s)])/mu);
  if (!match) return undefined;
  const line = Number(match[2]);
  const column = Number(match[3]);
  if (!Number.isSafeInteger(line) || line <= 0 || !Number.isSafeInteger(column) || column <= 0) return undefined;
  return `${match[1]}:${line}:${column}`;
}

function validFailureCode(failureClass: DemoLlmPreparationFailureClass, failureCode: string): boolean {
  if (failureClass === "none") return failureCode === "none";
  if (failureClass === "runner") return runnerFailureCodes.has(failureCode as RunnerFailureCategory);
  if (failureClass === "node-io") return /^node\.(?:eacces|eperm|ebusy|enoent|eexist|enotempty|eaddrinuse|econnrefused|econnreset|etimedout)$/u.test(failureCode);
  if (failureClass === "playwright-timeout") return failureCode === "playwright.timeout";
  if (failureClass === "error") return failureCode === "error.unknown";
  return failureCode === "unknown";
}
