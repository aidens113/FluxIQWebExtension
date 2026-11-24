// The options standing chosen as a call found the page, as its draft statement
// says them (t1023).
//
// Core counts the person's option done by the act's step that ran with it
// standing (`AS/runtime/flow-authoring/bootstrap/instructed-acts/standing-option.ts`),
// so a press says each option by its handle (`key`) and words, whether or not
// the page it left still shows it (`./unshown.ts` says those to the model).

import type { WebStandingChoice } from "./memory";

/** The draft statement's `chosen` for the options `stood`, or nothing when none stood. */
export function webStandingChoicesStated(stood: readonly WebStandingChoice[]): { key: string; words: string }[] | undefined {
  return stood.length ? stood.map((option) => ({ key: option.handle, words: option.words })) : undefined;
}
