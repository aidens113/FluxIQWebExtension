// The key a published page is retained by (t223): its location and its text.
// A repair names handles the model read in one published page, and
// `validateTargetOverrideEvidence` finds the structured binding behind that
// page by this key, where it used to key on the packet's elements.

import type { WebLlmPublishedPage } from "./published-page";

/** `location + " " + page`. */
export function webLlmPageRetentionKey(page: Pick<WebLlmPublishedPage, "location" | "page">): string {
  return `${page.location} ${page.page}`;
}
