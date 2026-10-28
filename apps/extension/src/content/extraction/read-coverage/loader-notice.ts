// The notice a list's loader wrote where the next part would have come, found
// for `./loader-wait.ts` (the read says the list paused) and for the moves that
// wait it out (`../page-advance/loader-pause/`, t762).
//
// What is looked at: the shown elements that follow the list's last item inside
// its container, then those that follow the container and each of its next
// `LEVELS` ancestors, at most `FOLLOWING` at each place -- where a loader puts
// its spinner and its notice. Each one's words are read through the shared
// sensitive-text reader, bounded, and matched against the closed wait and busy
// phrases the click's rate-limit watch uses (`../../action-runtime/interference/`).

import { isRateLimitLayerText, isTransientRefusalText } from "../../action-runtime/interference";
import { textOutsideSensitiveControls } from "../../sensitive-text";
import { followingTheList } from "./following-the-list";

/** How much of one element's words is matched: a notice is a sentence or two, not a page. */
const TEXT_MAX = 400;

/** The element holding the notice the loader asks the list to wait with, or `undefined` when the page shows none; see the header. */
export function loaderNoticeOf(run: readonly Element[]): Element | undefined {
  return followingTheList(run, saysWait);
}

function saysWait(element: Element): boolean {
  const text = textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim().slice(0, TEXT_MAX);
  return text !== "" && (isRateLimitLayerText(text) || isTransientRefusalText(text));
}
