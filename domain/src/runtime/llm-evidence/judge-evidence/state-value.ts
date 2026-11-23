import type { JsonObject } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";

const KEYS = new Set(["version", "location", "title", "controls", "notices", "marks", "truncated"]);
const LISTS = ["controls", "notices", "marks"] as const;
const WORDS = new Set(["tag", "role", "name", "label", "group", "heading", "within", "value", "selectedValue", "text"]);
const FLAGS = new Set(["checked", "expanded", "marked", "hidden"]);
const STATES = new Set(["aria-checked", "aria-selected", "aria-pressed", "aria-expanded", "aria-disabled", "disabled"]);

/** Strict versioned semantic-state reader: a capture cannot be smuggled into an allowed nested container. */
export function webJudgeStateValue(value: unknown): JsonObject | undefined {
  if (!isJsonRecord(value) || value.version !== 1 || typeof value.location !== "string" || Object.keys(value).some((key) => !KEYS.has(key))) return undefined;
  if (value.title !== undefined && typeof value.title !== "string") return undefined;
  if (value.truncated !== undefined && typeof value.truncated !== "boolean") return undefined;
  const lists = new Map<string, JsonObject[]>();
  for (const key of LISTS) {
    const rows = value[key];
    if (!Array.isArray(rows)) return undefined;
    const copies: JsonObject[] = [];
    for (const row of rows) {
      const copy = stateRow(row);
      if (copy === undefined) return undefined;
      copies.push(copy);
    }
    lists.set(key, copies);
  }
  // A typed copy in the input's own key order; every cell was checked above.
  const copy: JsonObject = {};
  for (const [key, cell] of Object.entries(value)) {
    const list = lists.get(key);
    if (list !== undefined) copy[key] = list;
    else if (typeof cell === "string" || typeof cell === "boolean" || typeof cell === "number") copy[key] = cell;
  }
  return copy;
}

function stateRow(row: unknown): JsonObject | undefined {
  if (!isJsonRecord(row) || typeof row.tag !== "string") return undefined;
  const copy: JsonObject = {};
  for (const [field, cell] of Object.entries(row)) {
    if (WORDS.has(field) && typeof cell === "string") copy[field] = cell;
    else if (FLAGS.has(field) && typeof cell === "boolean") copy[field] = cell;
    else if (field === "state" && isJsonRecord(cell)) {
      const states: JsonObject = {};
      for (const [name, state] of Object.entries(cell)) {
        if (!STATES.has(name) || typeof state !== "string") return undefined;
        states[name] = state;
      }
      copy[field] = states;
    } else return undefined;
  }
  return copy;
}
