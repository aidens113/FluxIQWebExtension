import type { ActionTarget } from "fluxiq/automation-studio";
import type { RecordingTargetPolicy } from "fluxiq/runtime/recording/target-policy";
import { isWebRecordingTarget } from "./target";
import { isWebElementTarget } from "../is";
import { validateWebElementTarget } from "../validate";

/** Actual web validation and original generic command envelope encoding. */
export const webRecordingTargetPolicy: RecordingTargetPolicy = {
  accepts: isWebRecordingTarget,
  commandTarget: value => ({ type: String(value.type ?? "client-target"), metadata: value }),
  targetIssues: (target: ActionTarget | null | undefined, path: string) => target?.elementTarget ? validateWebElementTarget(target.elementTarget, `${path}.elementTarget`).issues : [],
  parameterIssues: (parameters, path) => isWebElementTarget(parameters.target) ? validateWebElementTarget(parameters.target, `${path}.target`).issues : []
};
