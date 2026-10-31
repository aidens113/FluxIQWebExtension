import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListRequestValue, type WebAutomationExtractListRequest } from "../../actions/extraction";

/** Preserve an explicit read instant; otherwise share the execution reference with filtering and date sorting. */
export function webAutomationExtractListReferenceNow(
  parameters: JsonObject,
  referenceNow: number | undefined,
  request: WebAutomationExtractListRequest | undefined = webAutomationExtractListRequestValue(parameters.extractList)
): JsonObject {
  if (referenceNow === undefined || !Number.isSafeInteger(referenceNow) || referenceNow < 0 || referenceNow > 8.64e15) return parameters;
  const read = parameters.extractList;
  if (request === undefined || (!request.where?.length && !request.sort?.length) || request.now !== undefined || read === null || typeof read !== "object" || Array.isArray(read)) return parameters;
  return { ...parameters, extractList: { ...read, now: referenceNow } };
}
