import type { JsonObject } from "fluxiq/core";
import { isJsonRecord } from "../untrusted-json";

const KEYS = new Set(["version", "location", "title", "controls", "notices", "marks", "truncated"]);
const WORDS = new Set(["tag", "role", "name", "label", "group", "heading", "within", "value", "selectedValue", "text"]);
const FLAGS = new Set(["checked", "expanded", "marked", "hidden"]);
const STATES = new Set(["aria-checked", "aria-selected", "aria-pressed", "aria-expanded", "aria-disabled", "disabled"]);

/** Strict versioned semantic-state reader: a capture cannot be smuggled into an allowed nested container. */
export function webJudgeStateValue(value: unknown): JsonObject | undefined {
  if (!isJsonRecord(value) || value.version !== 1 || typeof value.location !== "string" || Object.keys(value).some((key) => !KEYS.has(key))) return undefined;
  if (value.title !== undefined && typeof value.title !== "string") return undefined;
  if (value.truncated !== undefined && typeof value.truncated !== "boolean") return undefined;
  for (const key of ["controls", "notices", "marks"] as const) {
    const rows = value[key];
    if (!Array.isArray(rows)) return undefined;
    for (const row of rows) {
      if (!isJsonRecord(row) || typeof row.tag !== "string") return undefined;
      for (const [field, cell] of Object.entries(row)) {
        if (WORDS.has(field) && typeof cell === "string") continue;
        if (FLAGS.has(field) && typeof cell === "boolean") continue;
        if (field === "state" && isJsonRecord(cell) && Object.entries(cell).every(([name, state]) => STATES.has(name) && typeof state === "string")) continue;
        return undefined;
      }
    }
  }
  return structuredClone(value);
}
