// The page as a model is shown it (t1036, P-b): the page's key and its lines in
// page order. The key is what makes two captures "the same page"
// (`./location-key.ts`); Core keeps the last view it delivered for each key in a
// run and sends the next one as the lines that changed. The lines' texts,
// joined by "\n", are the page text (`./joined-text.ts`).

import type { WebLlmPageLine } from "./keyed-line";

/** A page view: its key and its keyed lines. */
export type WebLlmPageView = { key: string; lines: WebLlmPageLine[] };
