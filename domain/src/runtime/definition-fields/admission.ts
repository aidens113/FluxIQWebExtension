// What a read may send to the selected browser when that browser cannot read
// semantic definition fields.
//
// A read of a detected list retains every safe column the detection found,
// beside the ones the plan asked for (`docs/architecture/retained-extraction.md`,
// t982). When the list has a definition-bound column, every read of it carried
// that column, so on a client without the definition capability an ordinary
// read the model asked only for ordinary columns was refused whole
// (`./capability-refusal.ts`), though nothing it asked for needed the feature.
//
// So a definition column the read only retains is left out of what is sent to
// such a client, and the read goes on with everything else. "Only retains"
// means nothing depends on it: the record output names the answer's columns
// (`process.columns`) and that list leaves it out; it is not `required`; no
// condition, sort, dedupe key, identity or other member of the request names
// it; and nothing dedupes by the whole row, whose identity would change without
// it. The record output's schema still holds it as the optional column it is,
// so it is simply absent from these rows rather than read wrongly: an older
// reader ignores the definition member and would read some other text under
// its key, which must never reach the data the answer is cleaned from.
//
// Anything else that needs a definition still refuses the whole read, exactly
// as before; a client that declares the capability gets the read unchanged.

import type { AutomationStudioFailureRecord } from "fluxiq/automation";
import { webActiveDefinitionField } from "./active-field";
import { webDefinitionFieldCapabilityRefusal } from "./capability-refusal";

/** The read to send, unchanged or without the definition columns it only retains, or why none may be sent. */
export type WebDefinitionFieldAdmission<Parameters> =
  | { status: "admitted"; parameters: Parameters }
  | { status: "failed"; message: string; failure: AutomationStudioFailureRecord };

/** Admit `parameters` for `session`, leaving out only retained definition columns that session cannot read. */
export function webDefinitionFieldAdmission<Parameters>(actionType: string, parameters: Parameters, session: unknown): WebDefinitionFieldAdmission<Parameters> {
  const refusal = webDefinitionFieldCapabilityRefusal(actionType, parameters, session);
  if (refusal === undefined) return { status: "admitted", parameters };
  const narrowed = withoutRetainedOnlyDefinitions(parameters);
  if (narrowed === undefined || webDefinitionFieldCapabilityRefusal(actionType, narrowed, session) !== undefined) return refusal;
  return { status: "admitted", parameters: narrowed };
}

/** A copy without the definition columns nothing but retention asked for, or undefined when there are none to leave out. */
function withoutRetainedOnlyDefinitions<Parameters>(parameters: Parameters): Parameters | undefined {
  const root = record(parameters);
  const request = record(root?.extractList);
  const fields = record(request?.fields);
  const output = record(root?.recordOutput);
  const process = record(output?.process);
  // Without a named answer view every column is the answer, so none is only retained.
  if (root === undefined || request === undefined || fields === undefined || !Array.isArray(process?.columns)) return undefined;
  const named = new Set<string>();
  let wholeRow = false;
  const visit = (value: unknown, path: readonly string[]): void => {
    if (typeof value === "string") named.add(value);
    else if (Array.isArray(value)) value.forEach((entry) => visit(entry, path));
    else if (record(value) !== undefined) {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const at = [...path, key];
        // The columns themselves, as read and as stored, are what is being decided; every other member is a use.
        if (same(at, ["extractList", "fields"]) || same(at, ["recordOutput", "schema", "fields"])) continue;
        if (key === "dedupe" && child === true) wholeRow = true;
        // A key names a column too, as a map keyed by column would.
        named.add(key);
        visit(child, at);
      }
    }
  };
  visit(root, []);
  if (wholeRow) return undefined;
  const left = Object.entries(fields).filter(([key, field]) => webActiveDefinitionField(field) && record(field)?.required !== true && !named.has(key)).map(([key]) => key);
  if (left.length === 0 || left.length === Object.keys(fields).length) return undefined;
  const narrowed = structuredClone(root);
  const kept = record(record(narrowed.extractList)?.fields)!;
  for (const key of left) delete kept[key];
  return narrowed as Parameters;
}

function same(path: readonly string[], expected: readonly string[]): boolean {
  return path.length === expected.length && path.every((part, index) => part === expected[index]);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
