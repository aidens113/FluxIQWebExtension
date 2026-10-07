// Reading `web.dom.next_page`'s answer off an untrusted value: the action
// result the content script built, on its way onto the wire
// (`client/gateway-mapping.ts`). Rebuilt field by field, so nothing a producer
// put beside the declared fields -- a pager's label, a page's text -- leaves
// the browser, and a word outside its outcome's closed set is not an answer.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationNextPageAnswer } from "./answer";
import { WEB_AUTOMATION_NEXT_PAGE_WORDS } from "./words";

/** The answer as declared, or `undefined` for a value that is not one. */
export function webAutomationNextPageAnswerValue(value: unknown): WebAutomationNextPageAnswer | undefined {
  const answer = jsonObject(value);
  if (!answer) return undefined;
  if (answer.outcome === "moved") {
    const by = memberOf(answer.by, WEB_AUTOMATION_NEXT_PAGE_WORDS.by);
    if (by === undefined) return undefined;
    if (answer.page === undefined) return { outcome: "moved", by };
    const page = positiveInteger(answer.page);
    return page === undefined ? undefined : { outcome: "moved", by, page };
  }
  if (answer.outcome === "ended") {
    const stop = memberOf(answer.stop, WEB_AUTOMATION_NEXT_PAGE_WORDS.ends);
    return stop === undefined ? undefined : { outcome: "ended", stop };
  }
  if (answer.outcome === "failed") {
    const stop = memberOf(answer.stop, WEB_AUTOMATION_NEXT_PAGE_WORDS.faults);
    return stop === undefined ? undefined : { outcome: "failed", stop };
  }
  return undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function memberOf<T extends string>(value: unknown, members: readonly T[]): T | undefined {
  return typeof value === "string" && (members as readonly string[]).includes(value) ? value as T : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
