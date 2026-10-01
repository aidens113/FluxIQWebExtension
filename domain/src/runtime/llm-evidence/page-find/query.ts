// What a page search was asked (t223): `{"query": "<1-200 chars>", "after"?: n}`.
//
// The query is read with its whitespace collapsed, so `"  Add   to cart "` is
// the same search as `"Add to cart"`; `after` is how many matches the model
// has already been given, so the next page starts there. Anything else refuses
// with the domain's own input reasons, naming the keys the tool takes.

import type { JsonObject } from "fluxiq/core";
import { recoverable, rejectionDetail, type WebLlmToolRejectionReason } from "../tool-rejection";

/** The longest query, in characters after whitespace is collapsed. */
const WEB_LLM_FIND_QUERY_MAX_LENGTH = 200;

const KEYS = ["query", "after"];

/** The query, whitespace-collapsed, and where in the matches this page starts. */
export function webLlmFindQuery(value: JsonObject): { query: string; after: number } {
  if (Object.keys(value).some((key) => !KEYS.includes(key))) refuse("unexpected_input_keys", KEYS);
  if (!Object.prototype.hasOwnProperty.call(value, "query")) refuse("missing_input_keys", KEYS);
  const query = typeof value.query === "string" ? value.query.replace(/\s+/gu, " ").trim() : undefined;
  if (query === undefined || query === "" || [...query].length > WEB_LLM_FIND_QUERY_MAX_LENGTH) refuse("value_not_text", undefined);
  const after = value.after === undefined ? 0 : value.after;
  if (typeof after !== "number" || !Number.isSafeInteger(after) || after < 0) refuse("not_a_number", undefined);
  return { query: query as string, after: after as number };
}

function refuse(reason: WebLlmToolRejectionReason, instead: string[] | undefined): never {
  return recoverable("invalid_input", rejectionDetail({ reason, target: undefined, instead, missing: undefined, requestId: undefined }));
}
