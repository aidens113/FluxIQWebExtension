import type { FacilityFailureDiagnostic } from "@fluxiq-web-extension/test-contracts";
import { classifyRunnerFailure, RunnerFailure } from "../failure.js";
import { boundedRunnerMessage } from "./bounded-runner-message.js";

const GENERIC_MESSAGE = "Scenario attempt failed outside a finalized bundle";

/**
 * An escaping scenario failure paired with its closed durable diagnostic.
 *
 * Its message is what the command line prints, so it says why when the runner
 * itself wrote the reason: the generic sentence, then the `RunnerFailure`'s own
 * message, bounded and redacted (`boundedRunnerMessage`). Any other error keeps
 * the generic sentence alone, because its text may be a library's or a page's.
 * Only the category and `facilityFailure` are ever persisted.
 */
export class ProjectedFacilityError extends RunnerFailure {
  readonly facilityFailure: FacilityFailureDiagnostic;

  constructor(error: unknown, facilityFailure: FacilityFailureDiagnostic) {
    super(classifyRunnerFailure(error), projectedMessage(error), { cause: error });
    this.name = "ProjectedFacilityError";
    this.facilityFailure = Object.freeze({ ...facilityFailure });
  }
}

function projectedMessage(error: unknown): string {
  if (!(error instanceof RunnerFailure)) return GENERIC_MESSAGE;
  let reason = "";
  try { reason = boundedRunnerMessage(String(error.message)); } catch { reason = ""; }
  return reason ? `${GENERIC_MESSAGE}: ${reason}` : GENERIC_MESSAGE;
}
