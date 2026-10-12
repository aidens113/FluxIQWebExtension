/** Which step of publishing a sealed bundle failed. */
export type EvidenceBundlePublicationStage =
  /** Renaming `.staging-<runId>` to `<runId>`, the normal publication. */
  | "rename-staging"
  /** Copying the sealed staging folder aside, the fallback when a reader blocks the rename. */
  | "copy-staging"
  /** Renaming that copy to `<runId>`. */
  | "rename-copy";

export type EvidenceBundlePublicationFailure = {
  stage: EvidenceBundlePublicationStage;
  /** The errno of the failure that ended publication (`EPERM`, `EBUSY`...), or `unknown`. */
  code: string;
  /** The staging rename's own errno when the fallback was what failed. */
  renameCode?: string | undefined;
  /** Rename attempts made at the failing stage. */
  attempts: number;
  /** Where the sealed bundle stays: its `bundle.complete.json` is written and verifies. */
  stagingPath: string;
  destination: string;
  cause: unknown;
};

/**
 * A sealed evidence bundle that could not be published under its final name.
 *
 * Only ever thrown after `bundle.complete.json` was written, so the staging
 * folder it names is a complete bundle: a reader of the runs folder may treat
 * it as a finalized run that did not publish, never as a run that was killed.
 * Its message is written here, from errno codes, a stage and the two paths, so
 * a command line may print it whole; it carries no page or provider text.
 * `code` is the errno, so the runner's cause classification still reads it.
 */
export class EvidenceBundlePublicationError extends Error {
  readonly code: string;
  readonly stage: EvidenceBundlePublicationStage;
  readonly renameCode: string | undefined;
  readonly attempts: number;
  readonly stagingPath: string;
  readonly destination: string;

  constructor(failure: EvidenceBundlePublicationFailure) {
    super(publicationMessage(failure), { cause: failure.cause });
    this.name = "EvidenceBundlePublicationError";
    this.code = failure.code;
    this.stage = failure.stage;
    this.renameCode = failure.renameCode;
    this.attempts = failure.attempts;
    this.stagingPath = failure.stagingPath;
    this.destination = failure.destination;
  }
}

function publicationMessage(failure: EvidenceBundlePublicationFailure): string {
  const attempts = `${failure.attempts} attempt${failure.attempts === 1 ? "" : "s"}`;
  const what = failure.stage === "rename-staging"
    ? `rename ${failure.code} after ${attempts}`
    : `rename ${failure.renameCode ?? "unknown"}, then ${failure.stage === "copy-staging" ? "copy" : `rename of the copy`} ${failure.code}${failure.stage === "rename-copy" ? ` after ${attempts}` : ""}`;
  return `Evidence bundle could not be published (stage bundle.publish, ${failure.stage}): ${what}; the sealed bundle stays at ${failure.stagingPath}`;
}
