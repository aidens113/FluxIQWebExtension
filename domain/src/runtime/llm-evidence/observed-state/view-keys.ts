// Every key of a web result Core replaces once a newer result shows the same
// kind of view: the page (`./observed-state-keys.ts`) and a read's rows
// (`./read-rows-keys.ts`). This is what the domain declares to Core as
// `observedStateKeys` (`../tools.ts`).

import { WEB_LLM_OBSERVED_STATE_KEYS } from "./observed-state-keys";
import { WEB_LLM_READ_ROWS_KEYS } from "./read-rows-keys";

/** The page's keys, then the read's rows' keys. */
export const WEB_LLM_VIEW_KEYS: readonly string[] = Object.freeze([...WEB_LLM_OBSERVED_STATE_KEYS, ...WEB_LLM_READ_ROWS_KEYS]);
