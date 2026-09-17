import { redactText } from "@fluxiq-web-extension/test-evidence";

/** A run of identifier characters long enough to be a key, a hash or an opaque id. */
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/gu;

/**
 * A runner-authored failure message made safe to print on one line: text
 * shaped like a credential is redacted by the evidence rule (`redactText`), a
 * long token that mixes letters and digits -- a key, a hash, a UUID -- is
 * redacted, whitespace collapses to single spaces, and the result is at most
 * `maxChars` characters, ending in an ellipsis when it was cut.
 *
 * A long name with no digit in it is kept on purpose. An environment variable
 * such as `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD` is exactly what
 * an operator needs to read, and it is no secret.
 */
export function boundedRunnerMessage(message: string, maxChars = 240): string {
  const line = redactText(message).replace(/\s+/gu, " ").trim();
  const redacted = line.replace(LONG_TOKEN, (token) => (/[0-9]/u.test(token) && /[A-Za-z]/u.test(token) ? "[REDACTED]" : token));
  return redacted.length <= maxChars ? redacted : `${redacted.slice(0, Math.max(0, maxChars - 1))}…`;
}
