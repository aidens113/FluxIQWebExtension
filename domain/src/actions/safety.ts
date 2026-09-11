import type { WebAutomationActionType } from "./types";

/**
 * The one safety classification of every web automation output. A "safe"
 * output only observes or waits on the page, so it runs unprivileged and
 * without operator approval and a provider-free run never prompts for it; a
 * "review" output acts on the page and needs approval. The domain manifest
 * (`io/manifest-definitions.ts`) and the output-node definitions
 * (`output-nodes/definitions.ts`) both derive their safety fields from this
 * record, and its `Record` type forces a classification for every new output.
 */
export const WEB_AUTOMATION_ACTION_SAFETY = {
  "web.browser.navigate": "review",
  "web.dom.click": "review",
  "web.dom.type": "review",
  "web.dom.clear": "review",
  "web.dom.select": "review",
  "web.dom.scroll": "review",
  "web.dom.keypress": "review",
  "web.dom.wait_for_selector": "safe",
  "web.dom.wait_for_text": "safe",
  "web.dom.extract": "safe",
  "web.dom.capture_snapshot": "safe"
} as const satisfies Record<WebAutomationActionType, "safe" | "review">;
