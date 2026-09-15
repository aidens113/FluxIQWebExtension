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

import { facilityFailureCauseCodes, type FailureCategory, type FacilityFailureCauseCode } from "@fluxiq-web-extension/test-contracts";

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
export type RunnerCauseKind = "module.missing" | "path.missing" | "path.denied" | "startup";
export type BoundedRunnerCause = Readonly<{ code: FacilityFailureCauseCode | "EADDRINUSE"; kind: RunnerCauseKind }>;

/** One shared allowlist for classification and durable projection. */
const RUNNER_CAUSE_CODES = new Set<string>([...facilityFailureCauseCodes, "EADDRINUSE"]);
const MAX_CAUSE_DEPTH = 4;

export function classifyRunnerFailure(error: unknown): RunnerFailureCategory {
  if (error instanceof RunnerFailure) return error.category;
  const cause = boundedRunnerCause(error);
  if (cause?.kind === "module.missing" || cause?.kind === "path.missing" || cause?.kind === "path.denied") return "environment.missing";
  if (cause?.kind === "startup") return "process.startup";
  return "unknown";
}

/** Selects the first recognized code through a bounded, getter-safe cause chain. */
export function boundedRunnerCause(error: unknown): BoundedRunnerCause | undefined {
  let current = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof current === "object" && current !== null; depth += 1) {
    try {
      if ("code" in current && typeof current.code === "string" && RUNNER_CAUSE_CODES.has(current.code)) {
        const code = current.code as BoundedRunnerCause["code"];
        return { code, kind: causeKind(code) };
      }
      current = "cause" in current ? current.cause : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function causeKind(code: BoundedRunnerCause["code"]): RunnerCauseKind {
  if (code === "ENOENT") return "path.missing";
  if (code === "EACCES" || code === "EPERM") return "path.denied";
  if (code === "MODULE_NOT_FOUND" || code.startsWith("ERR_")) return "module.missing";
  return "startup";
}
