// Routes a browser action to the verb that performs it. Action types arrive
// canonical: `domain/src/client/gateway-mapping.ts` is the one place a legacy
// dotted alias is normalized, so only canonical types are matched here.
// Anything else -- `web.browser.navigate`, `web.browser.tab`, and
// `web.browser.download`, which the background worker runs, or a type that
// reached this frame unchecked -- falls through to the throw.
// Every verb runs inside one try block timed from one start, so a throw
// becomes the caller's failure result. The two waits are awaited here rather
// than returned: a returned promise settles after the try block exits, and its
// rejection would escape the catch.

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
      return captureSnapshotAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.wait_for_selector") {
      return await waitForSelectorAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.wait_for_text") {
      return await waitForTextAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.extract") {
      return extractAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.click") {
      return clickAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.type") {
      return typeAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.clear") {
      return clearAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.select") {
      return selectAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.scroll") {
      return scrollAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.keypress") {
      return keypressAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.check") {
      return checkAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.assert") {
      return assertAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.extract_list") {
      return extractListAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.upload") {
      return uploadAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.dialog") {
      return dialogAction(action, deps, startedAt);
    }
    throw new Error(`Unsupported action type: ${action.actionType}`);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}
