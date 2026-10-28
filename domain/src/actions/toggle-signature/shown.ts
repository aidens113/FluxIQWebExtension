// Whether a control already shows a signature, so a press that would only
// flip it back is not made.

import type { WebToggleReading } from "./reading";
import type { WebToggleSignature } from "./signature";
import { webToggleWords } from "./words";

export function webToggleSignatureShown(signature: WebToggleSignature, reading: WebToggleReading): boolean {
  if (signature.via === "attribute") return reading.states[signature.attribute] === signature.to;
  const words = webToggleWords(reading.name);
  return signature.gains.every((word) => words.includes(word)) && signature.loses.every((word) => !words.includes(word));
}
