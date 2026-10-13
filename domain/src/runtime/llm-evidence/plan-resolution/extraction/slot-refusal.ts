// The refusal a read's refused `extractList` slot becomes in a plan node's
// answer (t497), under the parameter key that wrote it.
import { present } from "../../present";
import type { WebPlanValuePath } from "../handle-tokens";
import type { WebExtractionSlotResolution } from "./slot";

type RefusedSlot = Extract<WebExtractionSlotResolution, { status: "refused" }>;

/** A refused slot's refusal, its fields written by name (`present`), so its issues reach the model or fail the build. */
export type WebPlanSlotRefusal = {
  code: RefusedSlot["issue"];
  kind: "extraction";
  path: WebPlanValuePath;
  fits?: NonNullable<RefusedSlot["expected"]>;
  issues?: NonNullable<RefusedSlot["issues"]>;
};

/** The refusal of `slot`, written under `key`; an unknown column names the field and the read's columns (`issues`). */
export function webPlanSlotRefusal(key: string, slot: RefusedSlot): WebPlanSlotRefusal {
  return present<WebPlanSlotRefusal>({ code: slot.issue, kind: "extraction", path: [key, ...slot.path], fits: slot.expected, issues: slot.issues });
}
