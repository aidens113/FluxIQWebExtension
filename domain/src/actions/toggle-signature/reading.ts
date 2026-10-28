// What one look at a control says of its toggle state: each state it states
// for itself, and its accessible name. Both the page packet and a live DOM
// element are read into this shape, so one derive and one match serve both.

import type { WebToggleAttribute } from "./signature";

export type WebToggleReading = {
  /** Only the states the control states; a state it does not state is absent, never `false`. */
  states: Partial<Record<WebToggleAttribute, boolean>>;
  name: string;
};
