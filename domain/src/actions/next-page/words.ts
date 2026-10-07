// Every word of `web.dom.next_page`'s request and answer, in one place, so the
// two readers (`./request-value.ts`, `./answer-value.ts`) and the parameter
// schema (`./schema.ts`) admit exactly the words the types declare.

import type { WebAutomationNextPageBy, WebAutomationNextPageEnd, WebAutomationNextPageFault } from "./answer";
import type { WebAutomationNextPageWay } from "./request";

export const WEB_AUTOMATION_NEXT_PAGE_WORDS = {
  modes: ["next", "loadMore", "scroll", "numbered"],
  by: ["next", "following", "numbered", "loadMore", "scroll"],
  ends: ["control_absent", "control_disabled", "no_following_page", "scrolled_to_end"],
  faults: ["list_unchanged", "rate_limited", "list_vanished", "control_not_clickable", "page_fault"]
} as const satisfies {
  modes: readonly NonNullable<WebAutomationNextPageWay["mode"]>[];
  by: readonly WebAutomationNextPageBy[];
  ends: readonly WebAutomationNextPageEnd[];
  faults: readonly WebAutomationNextPageFault[];
};
