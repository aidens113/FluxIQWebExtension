import type { JsonObject } from "fluxiq/core";
import { webToggleSignatureValue } from "../../../actions/toggle-signature";
import { webAutomationNextPageAnswerValue } from "../../../actions/next-page";
import { isJsonRecord } from "../untrusted-json";

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
    const toggle = isJsonRecord(value.toggle) ? value.toggle : undefined;
    const signature = webToggleSignatureValue(toggle?.signature);
    const before = toggle?.beforeSignature === undefined ? undefined : webToggleSignatureValue(toggle.beforeSignature);
    if (signature === undefined || (toggle?.beforeSignature !== undefined && before === undefined) || (toggle?.idempotentWith !== undefined && toggle.idempotentWith !== "web.output.dom-check")) invalid = true;
    else facts.toggle = { signature: { ...signature }, ...(before === undefined ? {} : { beforeSignature: { ...before } }), ...(toggle?.idempotentWith === undefined ? {} : { idempotentWith: toggle.idempotentWith }) };
  }
  if (value.nextPage !== undefined) {
    const next = webAutomationNextPageAnswerValue(value.nextPage);
    if (next === undefined) invalid = true;
    else facts.nextPage = { ...next };
  }
  return { facts, invalid };
}
