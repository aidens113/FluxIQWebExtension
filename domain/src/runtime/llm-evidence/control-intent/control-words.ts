import type { WebLlmEvidenceElement } from "../elements";

/** A control's bounded own wording, never its ancestor's prose. */
export function controlWords(element: WebLlmEvidenceElement): string | undefined {
  const words = (element.name || element.label || element.ownText || element.text)?.trim().replace(/\s+/gu, " ");
  return words && words.length <= 80 ? words : undefined;
}

