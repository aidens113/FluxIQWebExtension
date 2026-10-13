// A parameter's own key written as a dotted key beside it (t486, W2).
//
// Lane D round 12 (`run-mv62icw0-070f88ad`, 0017/0018) read a detected list as
// `{ "extractList": "extraction.1", "extractList.fields": {...},
// "extractList.minItems": 0 }`. The dotted keys held no handle, so the resolver
// passed them through untouched, the page ignored two parameters the read does
// not take, and the read returned every raw column with nothing said.
//
// A dotted key whose head is a parameter the node holds, or one its schema
// names, is read as that parameter's own key -- `extractList.fields` as
// `extractList: { fields }`, deeper dots as deeper keys -- exactly as the nested
// form would be written. A head written as a bare handle (`"extraction.1"`)
// becomes `{ handle }`, the shape a slot reads. What cannot be read so is
// refused at the dotted key's place, never passed through:
//
// - `malformed`: the head holds a plain value, or a dot leaves an empty key;
// - `ambiguous`: the nested form already says something else at that place.
//
// A key whose head the node neither holds nor names is left alone: it is not a
// parameter of this node's to read.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";
import type { WebPlanValuePath } from "./handle-tokens";

export type WebPlanDottedKeys =
  | { ok: true; parameters: JsonObject; heads: ReadonlyMap<string, string> }
  /** `path` is the place the dotted key names, head first; `head` the parameter it belongs to. */
  | { ok: false; issue: "web.handle.malformed" | "web.handle.ambiguous"; path: WebPlanValuePath; head: string };

/**
 * `parameters` with every dotted key read into the parameter its head names
 * (header). `heads` maps each dotted key read to its head, so a caller tracking
 * who wrote which key can say the head was written too. `named` is every
 * parameter the node's schema names; `isHandle` says whether a string is a handle.
 */
export function webPlanReadDottedKeys(parameters: JsonObject, named: ReadonlySet<string>, isHandle: (value: string) => boolean): WebPlanDottedKeys {
  const dotted = Object.keys(parameters).filter((key) => key.includes(".") && !named.has(key));
  const heads = new Map<string, string>();
  if (dotted.length === 0) return { ok: true, parameters, heads };
  const out: JsonObject = { ...parameters };
  for (const key of dotted) {
    const [head, ...rest] = key.split(".");
    if (head === undefined || head === "") continue;
    const held = Object.hasOwn(out, head) ? out[head] : undefined;
    if (held === undefined && !named.has(head)) continue;
    const path: WebPlanValuePath = [head, ...rest];
    if (rest.some((segment) => segment === "")) return { ok: false, issue: "web.handle.malformed", path, head };
    const base = held === undefined ? {} : isJsonRecord(held) ? structuredClone(held) as JsonObject
      : typeof held === "string" && isHandle(held) ? { handle: held } : undefined;
    if (base === undefined) return { ok: false, issue: "web.handle.malformed", path, head };
    if (!placed(base, rest, parameters[key] as JsonValue)) return { ok: false, issue: "web.handle.ambiguous", path, head };
    out[head] = base;
    delete out[key];
    heads.set(key, head);
  }
  return { ok: true, parameters: out, heads };
}

/** `value` put at `path` in `into`; false when something else already stands there, or on the way there. */
function placed(into: JsonObject, path: readonly string[], value: JsonValue): boolean {
  let at = into;
  for (const segment of path.slice(0, -1)) {
    const next = at[segment];
    if (next === undefined) at[segment] = {};
    else if (!isJsonRecord(next)) return false;
    at = at[segment] as JsonObject;
  }
  const last = path[path.length - 1]!;
  if (at[last] !== undefined) return JSON.stringify(at[last]) === JSON.stringify(value);
  at[last] = value;
  return true;
}
