import type { JsonObject } from "fluxiq/core";
import { WEB_LLM_STRUCTURE_SCHEMA_VERSION } from "../structure";
import { present } from "../present";

/** What a judge reads of a detection: the list's size, its column keys and how it continues. Samples, labels and handles stay in the packet. */
type WebJudgeStructureFacts = { itemCount: number; fields: string[]; pagination: string; list?: string };

/**
 * A structure detection's packet as semantic facts (t1032), or `undefined` for anything else. Until this, a detection
 * was "evidence the domain did not recognise", so every judge of run-mwv5m906-5e999159 and run-mwuxd2v9-33928ea3 was
 * given a gap for each detection the attempt made, which Core holds every yes unsure for and no act or read can clear.
 */
export function webJudgeStructureFacts(evidence: JsonObject): WebJudgeStructureFacts | undefined {
  if (evidence.schemaVersion !== WEB_LLM_STRUCTURE_SCHEMA_VERSION) return undefined;
  const { itemCount, fields, pagination, list } = evidence;
  if (typeof itemCount !== "number" || !Number.isSafeInteger(itemCount) || itemCount < 0 || typeof pagination !== "string" || !Array.isArray(fields)) return undefined;
  const keys = fields.flatMap((field) => (typeof field === "object" && field !== null && !Array.isArray(field) && typeof field.key === "string" ? [field.key] : []));
  return present<WebJudgeStructureFacts>({ itemCount, fields: keys, pagination, list: typeof list === "string" ? list : undefined });
}
