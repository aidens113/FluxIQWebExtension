import { referenceCode } from "./reference.js";

/**
 * The 10% discount code the newsletter gives a subscriber, derived from the
 * address it was given to, so the same address always receives the same code
 * and a manifest can state it. `KL10-40721`.
 */
export function newsletterCode(email: string): string {
  return referenceCode("KL10", [email.trim().toLowerCase()]);
}
