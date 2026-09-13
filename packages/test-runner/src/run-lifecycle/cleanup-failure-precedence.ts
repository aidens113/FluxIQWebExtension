import type { RunnerFailureCategory } from "../failure.js";

type ExistingFailure = { category: RunnerFailureCategory | undefined; message: string | undefined };

export type CleanupFailureOutcome = {
  primary: { category: RunnerFailureCategory; message: string };
  event: {
    summary: string;
    details: {
      failureCategory: RunnerFailureCategory;
      cleanupStage: "browser" | "topology" | "clone-source-verification" | "clone-destination";
      primaryFailureCategory?: RunnerFailureCategory;
    };
  };
};

/** Keeps the first failure as the run result while always describing the later cleanup failure as its own event. */
export function cleanupFailureOutcome(
  existing: ExistingFailure,
  stage: CleanupFailureOutcome["event"]["details"]["cleanupStage"],
  cause: unknown,
  category: RunnerFailureCategory = "process.startup",
): CleanupFailureOutcome {
  const label = stage === "browser" ? "Browser cleanup" : stage === "topology" ? "Process cleanup" : stage === "clone-source-verification" ? "Clone source post-run verification" : "Clone destination cleanup";
  const cleanup = { category, message: `${label} failed: ${String(cause)}` };
  if (existing.category !== undefined && existing.message !== undefined) {
    return {
      primary: { category: existing.category, message: existing.message },
      event: {
        summary: cleanup.message,
        details: {
          failureCategory: cleanup.category,
          cleanupStage: stage,
          primaryFailureCategory: existing.category,
        },
      },
    };
  }
  return {
    primary: cleanup,
    event: {
      summary: cleanup.message,
      details: {
        failureCategory: cleanup.category,
        cleanupStage: stage,
      },
    },
  };
}
