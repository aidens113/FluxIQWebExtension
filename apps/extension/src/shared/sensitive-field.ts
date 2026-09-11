// Which form fields must never have their value recorded or sent: password
// inputs, one-time codes, card fields, and anything marked `data-sensitive`.
// One rule for both sides — the content script reads the signature from the
// element, the background worker from the wire descriptor — so the two cannot
// drift apart.

/** The three field attributes the sensitivity rule reads. */
export type SensitiveFieldSignature = {
  inputType?: string | undefined;
  autocomplete?: string | undefined;
  dataSensitive?: string | undefined;
};

const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set(["current-password", "new-password", "one-time-code"]);

/**
 * `autocomplete` is a space-separated token list (`section-*`, `shipping` or
 * `billing`, a contact kind, then the field name), so every token is checked:
 * `billing cc-number` is a card field.
 */
export function isSensitiveFieldSignature(signature: SensitiveFieldSignature): boolean {
  if (signature.inputType?.toLowerCase() === "password") return true;
  if (signature.dataSensitive === "true") return true;
  const tokens = (signature.autocomplete ?? "").toLowerCase().split(/\s+/u).filter(Boolean);
  return tokens.some((token) => SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith("cc-"));
}
