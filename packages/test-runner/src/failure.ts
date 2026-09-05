import type { FailureCategory } from "@fluxiq-web-extension/test-contracts";

export const runnerFailureCategories = [
  "environment.missing",
  "process.startup",
  "gateway.connection",
  "gateway.pairing",
  "recording.contract",
  "recording.persistence",
  "action.dispatch",
  "runtime.behavior",
  "test.flaky",
  "unknown",
] as const satisfies readonly FailureCategory[];
export type RunnerFailureCategory = FailureCategory;

export class RunnerFailure extends Error {
  readonly category: RunnerFailureCategory;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(category: RunnerFailureCategory, message: string, options: { cause?: unknown; details?: Readonly<Record<string, unknown>> } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "RunnerFailure";
    this.category = category;
    this.details = options.details;
  }
}

export function classifyRunnerFailure(error: unknown): RunnerFailureCategory {
  if (error instanceof RunnerFailure) return error.category;
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (["ENOENT", "EACCES", "EPERM"].includes(code)) return "environment.missing";
  if (["EADDRINUSE", "ECONNREFUSED", "ECONNRESET"].includes(code)) return "process.startup";
  return "unknown";
}
