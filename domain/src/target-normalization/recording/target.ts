import type { ActionTarget } from "fluxiq/automation-studio";
import { RecordingIngressShapes as S, isRecordingVisualTarget } from "fluxiq/client-gateway/recording/decoding";
import { isWebElementTarget } from "../is";
import { validateWebElementTarget } from "../validate";

const bounds = S.object<NonNullable<ActionTarget["bounds"]>>({ x: S.number, y: S.number, width: S.number, height: S.number });
const position = S.object<NonNullable<ActionTarget["relativePosition"]>>({ x: S.number, y: S.number });
const legacyTextFields = ["selector"] as const;
const accepts = S.object<Omit<ActionTarget, (typeof legacyTextFields)[number]>>({ type: S.string, id: S.optional(S.string), label: S.optional(S.string), bounds: S.optional(bounds), relativePosition: S.optional(position), visualTarget: S.optional(isRecordingVisualTarget), elementTarget: S.optional(isWebElementTarget), metadata: S.optional(S.jsonObject) });

/** The complete original ingress target guard, including opaque legacy scalar fields. */
export function isWebRecordingTarget(value: unknown): value is ActionTarget {
  if (!S.record(value)) return false;
  const legacyFieldsValid = legacyTextFields.every(key => value[key] === undefined || S.string(value[key]));
  return legacyFieldsValid && accepts(value)
    && (!value.elementTarget || validateWebElementTarget(value.elementTarget).ok);
}
