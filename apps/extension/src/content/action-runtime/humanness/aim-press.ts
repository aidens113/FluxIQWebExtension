// A press aimed the way a person aims it, at a humanness above 0: a point near
// the centre of the target (`point-near-centre.ts`), used only when the gate
// accepts it (`../actionability.ts`, `aimWithinTarget`): inside the target's
// visible box, landing on the target under the gate's own hit test, and on the
// same control as the centre. Otherwise the gate's own report stands, which is
// exactly the press made at humanness 0.

import { aimWithinTarget, type ActionabilityReport } from "../actionability";
import type { CommandHumanness } from "./command-humanness";
import { pointNearCentre } from "./point-near-centre";

type Actionable = Extract<ActionabilityReport, { actionable: true }>;

/** The report to press by: aimed near the centre when the gate accepts the point, else `undefined` and the gate's own stands. */
export function aimPress(element: Element, report: Actionable, human: CommandHumanness): Actionable | undefined {
  return aimWithinTarget(element, report, (area, centre) => pointNearCentre(area, centre, human));
}
