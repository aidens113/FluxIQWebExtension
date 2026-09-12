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
// The runner can now import the domain, through its `./node` export: the
// domain's build rewrites the extensionless relative specifiers that made its
// `dist` unusable to this `NodeNext`, tsc-and-node package. The evidence
// allowlist in `demo-llm-create-ui.ts` derives from the domain because of it.
// What still does not derive from the domain is the type below, and that is
// deliberate rather than blocked: `FailureCategory` is the test-rig taxonomy,
// answering why the *facility* could not produce a trustworthy run, which is a
// different question from how the *automation* failed. Keep them apart.

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
