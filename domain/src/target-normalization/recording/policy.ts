import type { AutomationStudioRecordingTargetPolicy } from "fluxiq/automation";
import { isWebElementTarget } from "../is";
import { validateWebElementTarget } from "../validate";

/** The web checks of a recording's target data, registered through the implementation bundle. */
export const webRecordingTargetPolicy: AutomationStudioRecordingTargetPolicy = {
  targetIssues: (target, path) => target.elementTarget ? validateWebElementTarget(target.elementTarget, `${path}.elementTarget`).issues : [],
  parameterIssues: (parameters, path) => isWebElementTarget(parameters.target) ? validateWebElementTarget(parameters.target, `${path}.target`).issues : []
};
