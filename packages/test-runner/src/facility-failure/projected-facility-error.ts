import type { FacilityFailureDiagnostic } from "@fluxiq-web-extension/test-contracts";
import { classifyRunnerFailure, RunnerFailure } from "../failure.js";

/** An escaping scenario failure paired with its closed durable diagnostic. */
export class ProjectedFacilityError extends RunnerFailure {
  readonly facilityFailure: FacilityFailureDiagnostic;

  constructor(error: unknown, facilityFailure: FacilityFailureDiagnostic) {
    super(classifyRunnerFailure(error), "Scenario attempt failed outside a finalized bundle", { cause: error });
    this.name = "ProjectedFacilityError";
    this.facilityFailure = Object.freeze({ ...facilityFailure });
  }
}
