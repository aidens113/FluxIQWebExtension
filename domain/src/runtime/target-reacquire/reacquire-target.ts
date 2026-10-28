// The web host's `reacquireTarget` (t786, D3-D4): Core has re-run the step a
// stale target came from, read-only, and asks which of its fresh answers is the
// same item. A row a For Each pass carried is matched among the re-read rows
// (`./row-match.ts`, with the read's key columns from `./row-key-columns.ts`);
// a value bound to another step's answer is matched as a control when it names
// one (`./element-match.ts`) and as a row when it is a record of values.
// Anything else -- a bare string, a number -- carries no identity beyond
// itself, and is `unidentifiable`. Pure: no page is read here.

import type { AutomationStudioTargetReacquireAnswer, AutomationStudioTargetReacquireRequest } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webReacquireElement } from "./element-match";
import { webReacquireRowKeyColumns } from "./row-key-columns";
import { webReacquireRow } from "./row-match";

const ELEMENT_KEYS = ["tagName", "selector", "accessibleName", "visibleText", "testId", "role"];

/** The same item among the source's fresh answer, by identity (header). */
export function webAutomationReacquireTarget(request: Pick<AutomationStudioTargetReacquireRequest, "lineage" | "source" | "stale" | "candidates">): AutomationStudioTargetReacquireAnswer {
  const { stale, candidates } = request;
  if (!record(stale)) return { outcome: "unmatched", reason: "unidentifiable" };
  if (request.lineage.kind === "output" && namesControl(stale)) return webReacquireElement({ stale, candidates });
  return webReacquireRow({ stale, candidates, keyColumns: webReacquireRowKeyColumns(request.source.parameterValues, stale) });
}

/** A fingerprint, or something carrying one under `element`. */
function namesControl(value: JsonObject): boolean {
  return record(value.element) || ELEMENT_KEYS.some((key) => typeof value[key] === "string");
}

function record(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
