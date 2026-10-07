// The one rule for naming an element by the words a reader sees, shared by the
// page view's line (`./words.ts`) and the route state's controls list
// (`../../../route-state/project.ts`), so the model reads one spelling of a
// control wherever it is named. Until U-B3-3 (lane B round 3,
// `run-mux6pndp-16feb842`) only the page view applied it, and the controls list
// still read a size chip as "12 Double Rolls$16.47".

import type { WebLlmEvidenceElement } from "../../elements";

/**
 * The element's readable words (`readable`) in place of `words` when the two
 * differ only by spacing: words the capture read from several blocks, run
 * together, are printed apart -- "Pickup or delivery? Carden Falls
 * Supercenter", not "Pickup or delivery?Carden Falls Supercenter" (lane B's
 * bigbox run, 2026-10-01). Words from anywhere else, an authored name, are
 * returned as they are.
 */
export function webLlmReadableWords(element: Pick<WebLlmEvidenceElement, "readable">, words: string | undefined): string | undefined {
  const spaced = element.readable;
  if (words === undefined || spaced === undefined) return words;
  return spaced.replace(/\s+/gu, "") === words.replace(/\s+/gu, "") ? spaced : words;
}
