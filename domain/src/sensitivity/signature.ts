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
// decision is made from three attributes, so a caller can ask before it reads.

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
  return (signature.autocomplete ?? "")
    .toLowerCase()
    .split(/\s+/u)
    .some((token) => Boolean(token) && (SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith(SENSITIVE_AUTOCOMPLETE_PREFIX)));
}

function isSensitiveControlType(type: string | undefined): boolean {
  return type !== undefined && SENSITIVE_CONTROL_TYPES.has(type.trim().toLowerCase());
}
