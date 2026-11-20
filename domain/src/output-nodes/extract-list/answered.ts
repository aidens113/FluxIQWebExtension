// A list read's answer with the two things the site's structure says of it, beside the rows (invariant I3).
//
// `listKey` is which list was read (`./list-key.ts`), made from the item selector and frame the read ran
// with. `place` is where in the list the page's pager said the read was (`page=3`, `offset=40`,
// `cursor=...`; `actions/extraction/list-continues.ts`), copied from the read's own summary and absent
// where the pager said nothing. Core reads both from the answer's holders beside `location`
// (`engine/automation/records/read/`), so a record batch carries them. Neither is ever worked out from the
// rows or from the address.
//
// The answer is the payload object holding `extracted`; anything else, and a read whose parameters name
// no list, is handed back as it is.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractionPlaceText, webAutomationExtractionSummaryValue } from "../../actions/extraction";
import { webAutomationExtractListKey } from "./list-key";

/** The answer with `listKey` and `place`, for a read run with `parameters` (the node's, resolved). */
export function webAutomationExtractListAnswered<T extends JsonValue | undefined>(parameters: JsonObject, answer: T): T {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return answer;
  const list = parameters.extractList;
  const item = typeof list === "object" && list !== null && !Array.isArray(list) ? list.item : undefined;
  if (typeof item !== "string" || item.trim() === "") return answer;
  const frameId = parameters.browserFrameId;
  const frameUrlPath = parameters.browserFrameUrlPath;
  const listKey = webAutomationExtractListKey({ item, ...(typeof frameId === "number" ? { frameId } : {}), ...(typeof frameUrlPath === "string" ? { frameUrlPath } : {}) });
  const place = webAutomationExtractionSummaryValue((answer as JsonObject).extraction)?.place;
  return { ...answer, listKey, ...(place !== undefined ? { place: webAutomationExtractionPlaceText(place) } : {}) } as T;
}
