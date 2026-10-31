import type { BrowserActionResult } from "../../types";
import type { ActionabilityReport } from "../actionability";

/** Only the gate's measured fact leaves the page; its hit point and explanation stay local. */
export function portableActionability(report: ActionabilityReport): NonNullable<BrowserActionResult["actionability"]> {
  return report.actionable ? { actionable: true } : { actionable: false, cause: report.code };
}
