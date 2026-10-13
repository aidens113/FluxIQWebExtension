// A `start` Core hands back, read as a state this module made, or `undefined`
// for anything else: Core keeps it opaque, so it is untrusted until checked.

import type { JsonObject } from "fluxiq/core";
import { present } from "../present";
import { WEB_START_STATE_SCHEMA_VERSION } from "./schema-version";
import type { WebStartState } from "./state";

/** `start` as a web start state, or `undefined` when it is not one. */
export function webStartStateOf(start: JsonObject | undefined): WebStartState | undefined {
  if (start === undefined || start === null || typeof start !== "object" || Array.isArray(start)) return undefined;
  if (start.schemaVersion !== WEB_START_STATE_SCHEMA_VERSION || typeof start.location !== "string") return undefined;
  if (start.title !== undefined && typeof start.title !== "string") return undefined;
  const lines = start.lines;
  if (!Array.isArray(lines) || !lines.every((line): line is string => typeof line === "string")) return undefined;
  const items = start.items;
  if (items !== undefined && !(Array.isArray(items) && items.every((item): item is string => typeof item === "string"))) return undefined;
  return present<WebStartState>({
    schemaVersion: WEB_START_STATE_SCHEMA_VERSION,
    location: start.location,
    title: start.title,
    lines: [...lines],
    items: items === undefined ? undefined : [...items]
  });
}
