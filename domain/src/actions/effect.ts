// Whether running a web action changes anything, in Core's two words.
//
// One derivation of one fact, from the one safety table (`./safety.ts`), so
// every caller that has to tell a read from an act gets the same answer. There
// were two derivations of it before this file: the exploration catalog built
// its own (`runtime/llm-evidence/node-run/catalog.ts`) and the plan-step gate
// had none at all, which is how a list extraction came to be put to Core's
// permission gate as though it might create something
// (`run-mueozmp8-348a2057`: the build declared `create_new` for reading a
// product list, and stopped to ask a person for permission to read the page
// its own instruction told it to read).
//
// `safe` and `observe` are the same claim in two vocabularies: the action only
// reads or waits, and the page -- and everything behind it -- is as it was
// afterwards. `review` and `mutate` likewise. The mapping is here rather than
// in Core because only this domain knows which of its actions is which; Core
// is told, action by action, on the declaration it answers
// (`AS/runtime/action-permissions/declaration.ts`).

import { WEB_AUTOMATION_ACTION_SAFETY } from "./safety";
import type { WebAutomationActionType } from "./types";

/** What this action does to the page, as Core's permission seam names it. */
export function webAutomationActionEffect(actionType: WebAutomationActionType): "observe" | "mutate" {
  return WEB_AUTOMATION_ACTION_SAFETY[actionType] === "review" ? "mutate" : "observe";
}
