// Where in a node's parameters a handle was refused, said so a model can find
// it and nothing it wrote is repeated.
//
// A refusal reaches the model as issue codes, each with the node's path and no
// prose (Core's `plan-parameter-resolution.ts`). A bare `web.handle.misplaced`
// told it neither where the handle was nor where it goes, and live builds
// repeated the same refusal until they gave up (`run-mu4xn1wz-6cdb8bbf`). So a
// refusal also carries `<reason>:<path>` for each place it was refused at.
//
// The path is quoted by position, never by value. A key is spelled out only
// when it is a parameter id at the top of the node, or one of the request and
// reference keys the grammar itself names; any other key -- a field key the
// model chose, which may have come from the page -- is given as its position
// among its object's keys, and an array entry as its index. Core bounds a code
// to 100 characters, so a longer path is cut at the end.

import { isJsonRecord } from "../untrusted-json";
import type { WebPlanValuePath } from "./handle-tokens";

/** Core's bound on one issue code, and its alphabet. */
const MAX_CODE_LENGTH = 100;
/** A top-level key spelled like a parameter id. */
const PARAMETER_ID = /^[a-z][A-Za-z0-9]{0,39}$/u;
/** Keys the request grammar and the handle reference name, which say nothing the model was shown. */
const GRAMMAR_KEYS: ReadonlySet<string> = new Set([
  "handle", "location", "item", "itemElement", "fields", "columns", "paginate", "minItems", "maxItems",
  "key", "field", "column", "header", "attribute", "required", "kind", "selector",
  // Which items are records (C5): the clause, the two keys that name its
  // value, and what it may say about it. Each is the grammar's own word, so
  // spelling it quotes nothing the model read off the page.
  "where", "read", "is", "atLeast", "atMost", "lessThan", "greaterThan",
  "mode", "next", "control", "pages", "maxPages", "maxScrolls",
  "parameters", "extractList", "target", "element", "recordOutput", "outputId"
]);

/** `code:path`, with the path read against `parameters` so that only structure is spelled. */
export function webPlanPositionCode(code: string, parameters: unknown, path: WebPlanValuePath): string {
  const segments: string[] = [];
  let at: unknown = parameters;
  for (const [depth, step] of path.entries()) {
    if (typeof step === "number") {
      segments.push(String(step));
      at = Array.isArray(at) ? at[step] : undefined;
      continue;
    }
    const quotable = depth === 0 ? PARAMETER_ID.test(step) : GRAMMAR_KEYS.has(step);
    segments.push(quotable ? step : String(isJsonRecord(at) ? Object.keys(at).indexOf(step) : 0));
    at = isJsonRecord(at) ? at[step] : undefined;
  }
  let written = `${code}:${segments.length ? segments.join(".") : "parameters"}`;
  while (written.length > MAX_CODE_LENGTH && segments.length > 1) {
    segments.pop();
    written = `${code}:${segments.join(".")}`;
  }
  return written.slice(0, MAX_CODE_LENGTH);
}
