// The test-rig failure taxonomy, as the runner raises and classifies it.
//
// `RunnerFailureCategory` is `FailureCategory` from
// `@fluxiq-web-extension/test-contracts`: why the *facility* could not produce
// a trustworthy run (fixture, environment, process, extension, gateway,
// recording, evidence). It is a different axis from the web-automation failure
// codes in `domain/src/runtime/failure/codes.ts`, which say how the
// *automation* failed and travel on `RunEvaluation.automationFailureReported`
// beside a Core `AutomationStudioAdaptiveFailureClass`. The two never merge: a
// run whose gateway pairing failed has no automation failure, and a run whose
// automation reported `web.target.not_found` is a healthy facility run.
//
// The runner cannot derive anything from the domain's closed code set today.
// `@fluxiq-web-extension/domain` is a bundler-only package: its `exports` map
// points at TypeScript source, and both that source and its emitted `dist`
// carry extensionless relative specifiers, so this `NodeNext`, tsc-and-node
// package can consume it neither at runtime nor for types. The dependency is
// declared, and the remedy is recorded in
// `docs/working/mvp-week1-web-automation-reliability-plan/reports/w3-runner-alignment.md`.

import type { FailureCategory } from "@fluxiq-web-extension/test-contracts";

/** Why the facility itself could not produce a trustworthy run; never how the automation failed. */
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
