// The key a published page is retained by (t223): its location and its text.
// A repair names handles the model read in one published page, and
// `validateTargetOverrideEvidence` finds the structured binding behind that
// page by this key, where it used to key on the packet's elements. The text is
// the view's (`./joined-text.ts`), extra lines included: they are what was shown.

import type { WebLlmPublishedPage } from "./published-page";
import { webLlmPageViewText } from "./joined-text";

/** `location + " " + text`. */
export function webLlmPageRetentionKey(page: Pick<WebLlmPublishedPage, "location" | "pageView">): string {
  return `${page.location} ${webLlmPageViewText(page.pageView)}`;
}
