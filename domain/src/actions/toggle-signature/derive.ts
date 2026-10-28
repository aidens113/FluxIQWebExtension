// The signature of a press from the control's reading before it and after it.

import type { WebToggleReading } from "./reading";
import type { WebToggleAttribute, WebToggleSignature } from "./signature";
import { webToggleWords } from "./words";

const ATTRIBUTES: readonly WebToggleAttribute[] = ["aria-pressed", "aria-checked", "aria-selected", "checked"];

/**
 * The stated state that flipped, else the name words gained and lost, else
 * `undefined` for a press that changed neither.
 */
export function webToggleSignatureOf(before: WebToggleReading, after: WebToggleReading): WebToggleSignature | undefined {
  for (const attribute of ATTRIBUTES) {
    const was = before.states[attribute];
    const now = after.states[attribute];
    if (was !== undefined && now !== undefined && was !== now) return { via: "attribute", attribute, to: now };
  }
  const was = webToggleWords(before.name);
  const now = webToggleWords(after.name);
  const gains = now.filter((word) => !was.includes(word));
  const loses = was.filter((word) => !now.includes(word));
  return gains.length === 0 && loses.length === 0 ? undefined : { via: "name", gains, loses };
}
