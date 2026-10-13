// The pressed control as a sentence about its press names it: its words as the
// page view prints them, then its handle (t511, `./no-effect.ts`,
// `./settled.ts`).

import { quotedWords, webLlmElementWords } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";

/** `"Save" (t6)`; `the control (t6)` where it has no words; `the control` where there is no handle. */
export function webPressedControlWords(page: WebLlmSnapshotBinding | undefined, handle: string | undefined): string {
  const element = handle === undefined ? undefined : page?.evidence.elements.find((candidate) => candidate.target === handle);
  const words = element === undefined ? undefined : webLlmElementWords(element);
  const named = words === undefined ? "the control" : quotedWords(words);
  return handle === undefined ? named : `${named} (${handle})`;
}
