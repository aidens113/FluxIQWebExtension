import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractionSummaryValue } from "../../../actions/extraction";
import { present } from "../present";

/** The condition counts a judge reads; kept values and samples stay in their own stores. */
type WebJudgeConditionFacts = { applied: number; kept: number; rejected: number[]; unfiltered: boolean; alone?: number[] };

/** Read counts/structure only. Full cells and comparison/removal evidence reuse their existing source-page store. */
export function webJudgeReadFacts(read: JsonObject): { facts: JsonObject; invalid: boolean } {
  const facts: JsonObject = {};
  let invalid = false;
  for (const key of ["listKey", "place"] as const) if (typeof read[key] === "string") facts[key] = read[key];
  for (const key of ["count", "total", "kept", "rejected"] as const) {
    if (read[key] === undefined) continue;
    if (typeof read[key] === "number" && Number.isSafeInteger(read[key]) && read[key] >= 0) facts[key] = read[key];
    else invalid = true;
  }
  if (read.truncated !== undefined) {
    if (typeof read.truncated === "boolean") facts.truncated = read.truncated;
    else invalid = true;
  }
  if (read.extraction !== undefined) {
    const parsed = webAutomationExtractionSummaryValue(read.extraction);
    if (parsed === undefined) invalid = true;
    else {
      const summary: JsonObject = { recordCount: parsed.recordCount, pagesRead: parsed.pagesRead, truncated: parsed.truncated };
      for (const key of ["itemsSeen", "emptyRecords", "notRenderedItems", "earlierPageRepeats", "disclosedRows", "paginationStop", "listPresence"] as const) if (parsed[key] !== undefined) summary[key] = parsed[key];
      if (parsed.conditions !== undefined) summary.conditions = present<WebJudgeConditionFacts>({ applied: parsed.conditions.applied, kept: parsed.conditions.kept, rejected: [...parsed.conditions.rejected], unfiltered: parsed.conditions.unfiltered, alone: parsed.conditions.alone === undefined ? undefined : [...parsed.conditions.alone] });
      if (parsed.order !== undefined) summary.order = { ...parsed.order };
      if (parsed.listContinues !== undefined) summary.listContinues = { ...parsed.listContinues };
      if (parsed.place !== undefined) summary.place = { ...parsed.place };
      facts.extraction = summary;
    }
  }
  return { facts, invalid };
}
