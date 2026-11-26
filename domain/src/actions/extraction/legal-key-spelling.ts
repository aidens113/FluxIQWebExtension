import { isWebAutomationExtractFieldKey } from "./field-key";

/**
 * The legal spelling of a written field key, for a refusal to offer in its place: each run of characters a key
 * may not hold becomes one `_`, none is left at either end, and it is held to the key's length. Absent when
 * nothing of the key survives or the result is still not a key (a prototype name).
 */
export function webAutomationExtractFieldKeySpelling(key: string): string | undefined {
  const spelled = key.replace(/[^A-Za-z0-9_-]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 100);
  return isWebAutomationExtractFieldKey(spelled) ? spelled : undefined;
}
