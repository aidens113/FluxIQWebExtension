// The options standing chosen on the page a call found, for a call that changes
// something (t1023).
//
// Only a node that changes the page states them (`./stated.ts`): a look, a read
// or a navigation is not an act the person's option could be done by, so nothing
// is asked of the memory for it. A build with no memory, or a call that found no
// page, finds none (`./memory.ts`, `standing`).

import type { WebLlmPageEvidence } from "../../sanitize";
import type { WebNodeBuildKey } from "../build-state";
import type { WebNodeStandingChoices, WebStandingChoice } from "./memory";

/** The options standing chosen on `page` as `build` found it, when the call `effect` changes the page; otherwise none. */
export function webStandingChoicesFound(
  choices: WebNodeStandingChoices | undefined,
  build: WebNodeBuildKey,
  page: WebLlmPageEvidence | undefined,
  effect: "observe" | "mutate"
): WebStandingChoice[] {
  return page && effect === "mutate" ? choices?.standing(build, page) ?? [] : [];
}
