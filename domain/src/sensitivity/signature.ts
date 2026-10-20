// Which form controls hold a secret. This is the one rule; every other site
// asks it rather than restating it.
//
// It lives in the domain package rather than in the extension because that is
// the only place all five callers can reach: the structure audit forbids
// `domain/src` importing `apps/extension/src`, while the extension already
// depends on `@fluxiq-web-extension/domain/client`. Before Wave 3 the rule
// existed in four places and they did not agree -- the LLM evidence packet's
// copy compared the whole `autocomplete` attribute instead of its tokens, so
// `billing cc-number`, which is what a real card field carries, was not
// sensitive to it. A duplicated sensitivity rule is not hypothetical here: one
// leaked a billing card number in Wave 2.
//
// Signature, never value. Nothing here is given a control's contents; the
// decision is made from what the control is -- its type, its `autocomplete`,
// its `data-sensitive`, what its author called it and the words that label it
// -- so a caller can ask before it reads.
//
// What the rule cannot see is where the control sits. A control inside an
// element marked `data-sensitive` holds part of what that element holds; the
// extension's content script asks this rule of every ancestor
// (`isWithinSensitiveControl`, `content/sensitive-text.ts`), because only it
// holds the live tree.

import { namesCardSecurityCode } from "./card-security-code";

/**
 * The attributes the rule reads.
 *
 * `inputType` is the live control's effective type (`HTMLInputElement.type`),
 * `controlType` the raw `type` attribute a serialized descriptor carries.
 * Both are consulted because the two sides of the wire have one each, and a
 * caller that has only the attribute must not get a weaker answer than a
 * caller holding the element.
 */
export type SensitiveFieldSignature = {
  inputType?: string | undefined;
  controlType?: string | undefined;
  autocomplete?: string | undefined;
  dataSensitive?: string | undefined;
  /** What the author called the control: its `name` and `id`. Consulted for a text-entry input only; anything but a string is ignored, so a wire value may be handed over as it came. */
  names?: ReadonlyArray<unknown> | undefined;
  /** The words that label the control: its `<label>`, `aria-label`, accessible name or placeholder. Consulted for a text-entry input only; anything but a string is ignored, so a wire value may be handed over as it came. */
  labels?: ReadonlyArray<unknown> | undefined;
};

/**
 * Control types that hold a secret. `password` is the real one. `one-time-code`
 * and `credit-card` are not HTML input types at all -- they are `autocomplete`
 * tokens -- but `domain/src/runtime/reusable-evidence.ts` tested for them as
 * types before this rule existed, and dropping them would make that call site
 * less strict than it is today. They cost nothing and they are kept.
 */
const SENSITIVE_CONTROL_TYPES = new Set(["password", "one-time-code", "credit-card"]);

/** `autocomplete` tokens that name a secret outright. Card fields are matched by prefix below. */
const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set(["current-password", "new-password", "one-time-code"]);

/** Every `cc-` token is a payment-card field: `cc-number`, `cc-exp`, `cc-csc`, `cc-name`. */
const SENSITIVE_AUTOCOMPLETE_PREFIX = "cc-";

/**
 * Input types a person types a code into; `""` is an input whose `type`
 * attribute was never written, as a serialized descriptor reports it. A name or
 * label is consulted only for these: a button that says "Security code" or a
 * checkbox named `cvc` holds no typed code.
 */
const TEXT_ENTRY_TYPES: ReadonlySet<string> = new Set(["", "text", "tel", "number", "password", "search"]);

/**
 * Whether the control this signature describes must never yield its value.
 *
 * `autocomplete` is a space-separated token list -- an optional `section-*`,
 * then `shipping` or `billing`, then a contact kind, then the field name -- so
 * every token is checked. `billing cc-number` is a card field, and matching
 * only the whole attribute is how one copy of this rule missed it.
 *
 * The attribute is read in full rather than through a display bound: truncating
 * the input to a security predicate is a way past it, and this string is never
 * carried anywhere, only inspected.
 */
export function isSensitiveFieldSignature(signature: SensitiveFieldSignature): boolean {
  if (isSensitiveControlType(signature.inputType) || isSensitiveControlType(signature.controlType)) return true;
  if (signature.dataSensitive?.trim().toLowerCase() === "true") return true;
  const cardToken = (signature.autocomplete ?? "")
    .toLowerCase()
    .split(/\s+/u)
    .some((token) => Boolean(token) && (SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith(SENSITIVE_AUTOCOMPLETE_PREFIX)));
  return cardToken || namedCardSecurityCode(signature);
}

/**
 * A text-entry input whose name, id or label names a card security code
 * (`card-security-code.ts`). The effective type wins over the raw attribute,
 * as the browser's does; a signature that reports neither is not an input.
 */
function namedCardSecurityCode(signature: SensitiveFieldSignature): boolean {
  const type = signature.inputType ?? signature.controlType;
  if (type === undefined || !TEXT_ENTRY_TYPES.has(type.trim().toLowerCase())) return false;
  return [...(signature.names ?? []), ...(signature.labels ?? [])]
    .some((words) => typeof words === "string" && namesCardSecurityCode(words));
}

function isSensitiveControlType(type: string | undefined): boolean {
  return type !== undefined && SENSITIVE_CONTROL_TYPES.has(type.trim().toLowerCase());
}
