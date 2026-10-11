import type { FacilityFailureDiagnostic } from "@fluxiq-web-extension/test-contracts";
import { EvidenceBundlePublicationError } from "@fluxiq-web-extension/test-evidence";
import { classifyRunnerFailure, RunnerFailure } from "../failure.js";
import { boundedRunnerMessage } from "./bounded-runner-message.js";

const GENERIC_MESSAGE = "Scenario attempt failed outside a finalized bundle";

/**
 * An escaping scenario failure paired with its closed durable diagnostic.
 *
 * Its message is what the command line prints, so it says why when the runner
 * itself wrote the reason: the generic sentence, then the `RunnerFailure`'s own
 * message, bounded and redacted (`boundedRunnerMessage`). An evidence bundle
 * that was sealed but could not be published (`EvidenceBundlePublicationError`)
 * is the runner's own text too -- errno codes, a stage and the folder the bundle
 * stays in -- and is printed the same way. Any other error's text may be a
 * library's or a page's, so it is never printed; the sentence instead names the
 * stage, reason and errno from the closed diagnostic, which is all the
 * command line would otherwise drop. Only the category and `facilityFailure`
 * are ever persisted.
 */
export class ProjectedFacilityError extends RunnerFailure {
  readonly facilityFailure: FacilityFailureDiagnostic;

  constructor(error: unknown, facilityFailure: FacilityFailureDiagnostic) {
    super(classifyRunnerFailure(error), projectedMessage(error, facilityFailure), { cause: error });
    this.name = "ProjectedFacilityError";
    this.facilityFailure = Object.freeze({ ...facilityFailure });
  }
}

function projectedMessage(error: unknown, facilityFailure: FacilityFailureDiagnostic): string {
  if (!(error instanceof RunnerFailure) && !(error instanceof EvidenceBundlePublicationError)) return `${GENERIC_MESSAGE}${closedCause(facilityFailure)}`;
  let reason = "";
  // A publication failure ends in the folder the sealed bundle stays in, which a 240-character cut would lose.
  try { reason = boundedRunnerMessage(String(error.message), error instanceof EvidenceBundlePublicationError ? 640 : undefined); } catch { reason = ""; }
  return reason ? `${GENERIC_MESSAGE}: ${reason}` : GENERIC_MESSAGE;
}

/** ` at <stage> (<reason> <errno>)`, from the diagnostic's closed vocabulary only. */
function closedCause({ stage, reason, causeCode }: FacilityFailureDiagnostic): string {
  return ` at ${stage} (${reason}${causeCode === undefined ? "" : ` ${causeCode}`})`;
}
