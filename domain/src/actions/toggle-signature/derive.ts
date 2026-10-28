// The signature of a press from the control's reading before it and after it.

import type { WebToggleReading } from "./reading";
import type { WebToggleAttribute, WebToggleSignature } from "./signature";
import { webToggleClassDelta } from "./class-delta";
import { webToggleWords } from "./words";

const ATTRIBUTES: readonly WebToggleAttribute[] = ["aria-pressed", "aria-checked", "aria-selected", "checked"];

/**
 * The stated state that flipped, else the name words gained and lost, else the class tokens gained and lost, else
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
  if (gains.length > 0 || loses.length > 0) return { via: "name", gains, loses };
  return classSignature(before.classes ?? [], after.classes ?? []);
}

/** The nearest level (the element, then its wrappers) whose classes changed beyond the transient ones. */
function classSignature(before: readonly string[][], after: readonly string[][]): WebToggleSignature | undefined {
  for (let level = 0; level < Math.min(before.length, after.length); level += 1) {
    const { gains, loses } = webToggleClassDelta(before[level]!, after[level]!);
    if (gains.length > 0 || loses.length > 0) return { via: "class", gains, loses };
  }
  return undefined;
}
