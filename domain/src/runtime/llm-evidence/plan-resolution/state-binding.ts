// A bound parameter value: Core's executor's own `{"$state": {path, fallback?}}`
// leaf (t252, D3).
//
// The model writes `{"$row": field}`, `{"$input": name, "test": value}` or
// `{"$step": n, "output": port}`, and Core translates each once, before the
// step reaches this domain, into the leaf its executor resolves when the Flow
// runs -- against the For Each row, the Flow's inputs and earlier outputs
// (`AS/runtime/executor/node-execution.ts`). So a leaf that reaches this domain
// is a value only the Flow's run can know. Plan-time resolution passes it
// untouched: it names no handle (`./handle-tokens.ts` finds none in it), so
// `./resolve-plan-node.ts` copies it as it copies any literal. A written
// step's parameter check counts it as given and does not judge its kind
// (`../node-run/written-step.ts`), because the value it stands for is not here
// to judge.

import { isJsonRecord } from "../untrusted-json";

/** The one key a bound value is written under. */
const STATE_KEY = "$state";

/** Whether a parameter value is a bound one: exactly `{"$state": {path: <non-empty string>, ...}}`. */
export function isWebPlanStateBinding(value: unknown): boolean {
  if (!isJsonRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== STATE_KEY) return false;
  const binding = value[STATE_KEY];
  return isJsonRecord(binding) && typeof binding.path === "string" && binding.path !== "";
}
