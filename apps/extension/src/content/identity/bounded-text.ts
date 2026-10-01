// A short quote of page text, for the readers that must keep it short: a
// failure message naming the candidates it weighed (`reportable-text.ts`), and
// a For Each row's values, cut where the domain cuts them before a replay
// compares the two (`record.ts`). Every identity signal and every piece of page
// evidence is whole and reads `normalized-text.ts` instead (t200).

import { normalizedText } from "./normalized-text";

/** Normalized, trimmed and capped text, or `undefined` when nothing is left. */
export function boundedText(value: string | null | undefined, maxLength: number): string | undefined {
  return normalizedText(value)?.slice(0, maxLength);
}
