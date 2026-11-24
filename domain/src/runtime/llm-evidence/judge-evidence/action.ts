import type { JsonObject, JsonValue } from "fluxiq/core";
import { webToggleOutput, webToggleSignatureValue, type WebToggleSignature } from "../../../actions/toggle-signature";
import { webAutomationNextPageAnswerValue, type WebAutomationNextPageAnswer, type WebAutomationNextPageBy, type WebAutomationNextPageEnd, type WebAutomationNextPageFault } from "../../../actions/next-page";
import { isJsonRecord } from "../untrusted-json";
import { present } from "../present";

/** A toggle's checked signature facts; every key is written by name so a renamed field cannot leave silently. */
type WebJudgeToggleFacts = { signature: WebToggleSignature; beforeSignature?: WebToggleSignature; idempotentWith?: "web.output.dom-check" };
/** Each checked Next answer, one shape per outcome, written by name. */
type WebJudgeNextPageMoved = { outcome: "moved"; by: WebAutomationNextPageBy; page?: number };
type WebJudgeNextPageEnded = { outcome: "ended"; stop: WebAutomationNextPageEnd };
type WebJudgeNextPageFailed = { outcome: "failed"; stop: WebAutomationNextPageFault; filtersDropped?: number };

/** Typed outcome facts only; nested arbitrary objects never ride on an allowed outcome key. */
export function webJudgeActionFacts(value: JsonObject): { facts: JsonObject; invalid: boolean } {
  const facts: JsonObject = {};
  let invalid = false;
  for (const key of ["node", "status", "code", "reason", "said", "actedOn", "actedOnItem", "actedOnCard", "choice", "control", "noEffect", "pressedAgain", "effectUncertain", "skipped", "route"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] === "string") facts[key] = value[key];
    else invalid = true;
  }
  for (const key of ["ok", "pageChanged", "pageUnreadable"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] === "boolean") facts[key] = value[key];
    else invalid = true;
  }
  for (const key of ["changed", "notice"] as const) {
    if (value[key] === undefined) continue;
    const lines = value[key];
    if (Array.isArray(lines) && lines.every((line) => typeof line === "string")) facts[key] = [...lines];
    else invalid = true;
  }
  if (value.attempts !== undefined) {
    if (typeof value.attempts === "number" && Number.isSafeInteger(value.attempts) && value.attempts >= 0) facts.attempts = value.attempts;
    else invalid = true;
  }
  if (value.toggle !== undefined) {
    const toggle = toggleFacts(value.toggle, value.toggleBefore);
    if (toggle === undefined) invalid = true;
    else facts.toggle = toggle;
  }
  if (value.nextPage !== undefined) {
    const next = webAutomationNextPageAnswerValue(value.nextPage);
    if (next === undefined) invalid = true;
    else facts.nextPage = nextPageFacts(next);
  }
  return { facts, invalid };
}

/**
 * A press's toggle, in either shape it reaches the projector in: as Core is told it (`webToggleOutput`, a `signature`
 * with its `beforeSignature`), on an explored press and at the top of a dispatch; or as the click verb answered it, the
 * signature itself with its reverse beside it as `toggleBefore`, inside the client's result a Flow attempt's evidence is
 * read from (`./project.ts`). Only the first was read, so every Flow press that flipped its own control was refused as
 * invalid and left its trial unconfirmed (t1029). Both become the one told shape.
 */
function toggleFacts(raw: JsonValue, rawBefore: JsonValue | undefined): WebJudgeToggleFacts | undefined {
  const told = isJsonRecord(raw) && Object.hasOwn(raw, "signature") ? raw : undefined;
  if (told !== undefined) {
    const signature = webToggleSignatureValue(told.signature);
    const before = told.beforeSignature === undefined ? undefined : webToggleSignatureValue(told.beforeSignature);
    if (signature === undefined || (told.beforeSignature !== undefined && before === undefined) || (told.idempotentWith !== undefined && told.idempotentWith !== "web.output.dom-check")) return undefined;
    return present<WebJudgeToggleFacts>({ signature: { ...signature }, beforeSignature: before === undefined ? undefined : { ...before }, idempotentWith: told.idempotentWith === "web.output.dom-check" ? "web.output.dom-check" : undefined });
  }
  const signature = webToggleSignatureValue(raw);
  const before = rawBefore === undefined ? undefined : webToggleSignatureValue(rawBefore);
  if (signature === undefined || (rawBefore !== undefined && before === undefined)) return undefined;
  const output = webToggleOutput(signature, before);
  return present<WebJudgeToggleFacts>({ signature: { ...output.signature }, beforeSignature: output.beforeSignature === undefined ? undefined : { ...output.beforeSignature }, idempotentWith: output.idempotentWith });
}

function nextPageFacts(next: WebAutomationNextPageAnswer): WebJudgeNextPageMoved | WebJudgeNextPageEnded | WebJudgeNextPageFailed {
  if (next.outcome === "moved") return present<WebJudgeNextPageMoved>({ outcome: next.outcome, by: next.by, page: next.page });
  if (next.outcome === "ended") return present<WebJudgeNextPageEnded>({ outcome: next.outcome, stop: next.stop });
  return present<WebJudgeNextPageFailed>({ outcome: next.outcome, stop: next.stop, filtersDropped: next.filtersDropped });
}
