// Whether a step's literal identity agrees with the one its bound handle
// resolved to (`resolve-plan-node.ts`, the bound-target conflict check): equal
// value for value, whatever order an object's keys were written in. Moved out
// of the resolver whole (t743) when that file reached its line budget.

import type { JsonValue } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";

/** Object key order cannot turn an agreeing explicit identity into a conflict. */
export function webPlanSameTargetIdentity(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  if (left === undefined || right === undefined) return false;
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => webPlanSameTargetIdentity(value, right[index]));
  if (!isJsonRecord(left) || !isJsonRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && webPlanSameTargetIdentity(left[key] as JsonValue, right[key] as JsonValue));
}
