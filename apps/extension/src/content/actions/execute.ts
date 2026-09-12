// Routes a browser action to the verb that performs it. Action types arrive
// canonical: `domain/src/client/gateway-mapping.ts` is the one place a legacy
// dotted alias is normalized, so only canonical types are matched here.
// Anything else -- `web.browser.navigate`, `web.browser.tab`, and
// `web.browser.download`, which the background worker runs, or a type that
// reached this frame unchecked -- falls through to the throw.
// Every verb runs inside one try block timed from one start, and every verb is
// awaited rather than returned. A returned promise settles after the try block
// exits, so its rejection escapes the catch, the content script never replies,
// and nothing upstream ends the command: Core applies no runtime deadline to a
// web action. Only the two waits were awaited until 2026-09-11, when three Wave
// 2 workers found the hole independently.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";
import { captureSnapshotAction } from "./capture-snapshot";
import { waitForSelectorAction } from "./wait-for-selector";
import { waitForTextAction } from "./wait-for-text";
import { extractAction } from "./extract";
import { clickAction } from "./click";
import { typeAction } from "./type";
import { clearAction } from "./clear";
import { selectAction } from "./select";
import { scrollAction } from "./scroll";
import { keypressAction } from "./keypress";
import { checkAction } from "./check";
import { assertAction } from "./assert";
import { extractListAction } from "./extract-list";
import { uploadAction } from "./upload";
import { dialogAction } from "./dialog";

export async function executeContentAction(action: BrowserActionCommand, deps: ContentActionDependencies): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  try {
    if (action.actionType === "web.dom.capture_snapshot") {
      return await captureSnapshotAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.wait_for_selector") {
      return await waitForSelectorAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.wait_for_text") {
      return await waitForTextAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.extract") {
      return await extractAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.click") {
      return await clickAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.type") {
      return await typeAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.clear") {
      return await clearAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.select") {
      return await selectAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.scroll") {
      return await scrollAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.keypress") {
      return await keypressAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.check") {
      return await checkAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.assert") {
      return await assertAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.extract_list") {
      return await extractListAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.upload") {
      return await uploadAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.dialog") {
      return await dialogAction(action, deps, startedAt);
    }
    throw new Error(`Unsupported action type: ${action.actionType}`);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}
