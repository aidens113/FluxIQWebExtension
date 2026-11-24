// The options standing chosen as a call found the page, as its draft statement
// says them (t1023).
//
// Core counts the person's option done by the act's step that ran with it
// standing (`AS/runtime/flow-authoring/bootstrap/instructed-acts/standing-option.ts`),
// so a press says each option by its handle (`key`) and words, whether or not
// the page it left still shows it (`./unshown.ts` says those to the model), and
// what finds it again (`at`, `./at.ts`, t1030) where the look that showed it
// resolved it: Core writes that onto the saved act as an option it requires.

import type { JsonObject } from "fluxiq/core";
import { present } from "../../present";
import type { WebStandingChoice } from "./memory";

/** The draft statement's `chosen` for the options `stood`, or nothing when none stood. */
export function webStandingChoicesStated(stood: readonly WebStandingChoice[]): WebStandingChoiceStated[] | undefined {
  return stood.length ? stood.map((option) => present<WebStandingChoiceStated>({ key: option.handle, words: option.words, at: option.at ? structuredClone(option.at) : undefined })) : undefined;
}

/** One option as a draft statement's `chosen` says it. */
type WebStandingChoiceStated = { key: string; words: string; at?: JsonObject };
