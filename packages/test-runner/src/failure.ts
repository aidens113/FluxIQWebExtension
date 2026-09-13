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
// allowlist in `demo-llm-create-ui/` derives from the domain because of it.
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

/**
 * Node's codes for a module the facility needed and could not load, all of
 * them `environment.missing`: something the run depends on was not where it
 * had to be, so the facility could not produce a trustworthy run.
 *
 * These are here because two whole benches were lost to them and both were
 * recorded as `unknown`. FluxIQ Core lives in a sibling checkout, its build
 * cleans and re-emits `dist`, and a Lab run that imports Core while that
 * happens gets `ERR_MODULE_NOT_FOUND` for a file that exists again seconds
 * later. The same code covers the concurrency incident of the same day, where
 * one instance's compiled scenario lab could not resolve a workspace package.
 * The message names the missing path in both cases; only the classification
 * was missing, and `unknown` is what stopped anyone reading it.
 *
 * The export-map codes belong with them: a `package.json` caught half-written
 * mid-rebuild raises those rather than the not-found ones, and it is the same
 * fault.
 */
const MISSING_MODULE_CODES = ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_PACKAGE_IMPORT_NOT_DEFINED", "ERR_UNSUPPORTED_DIR_IMPORT"];
/** Filesystem codes for a path the facility required and could not reach. */
const MISSING_PATH_CODES = ["ENOENT", "EACCES", "EPERM"];
/** Socket codes raised while a run's processes are coming up. */
const STARTUP_CODES = ["EADDRINUSE", "ECONNREFUSED", "ECONNRESET"];

export function classifyRunnerFailure(error: unknown): RunnerFailureCategory {
  if (error instanceof RunnerFailure) return error.category;
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (MISSING_PATH_CODES.includes(code) || MISSING_MODULE_CODES.includes(code)) return "environment.missing";
  if (STARTUP_CODES.includes(code)) return "process.startup";
  return "unknown";
}
