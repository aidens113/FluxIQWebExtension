// The page view of a capture (t1036, P-a and P-b): its key and its keyed lines.

import type { WebLlmPageEvidence } from "../sanitize";
import type { WebLlmPageView } from "./keyed-view";
import { webLlmPageKey } from "./location-key";
import { webLlmPageViewLines } from "./written-lines";

/** The keyed page view of a structured packet. */
export function webLlmPageView(evidence: WebLlmPageEvidence): WebLlmPageView {
  return { key: webLlmPageKey(evidence.location), lines: webLlmPageViewLines(evidence) };
}
