// What the web domain keeps of the page a build began on (t462): opaque to
// Core, which hands it back on the next `startState` ask.

import type { WEB_START_STATE_SCHEMA_VERSION } from "./schema-version";

export type WebStartState = {
  schemaVersion: typeof WEB_START_STATE_SCHEMA_VERSION;
  /** The screened address, as the page view spells it. */
  location: string;
  title?: string;
  /**
   * The page view's element lines, handle-free (`../page-view/handle-free-lines.ts`),
   * then one row per element that is not rendered, as a result check's passive
   * view prints it. Lines of a dialog or a layer in front of the page are left out.
   */
  lines: string[];
  /**
   * The opaque tokens of the records -- rows, cards, list items -- the kept
   * elements sit in (`../control-spot.ts`), in the form Core's declaration
   * takes them (FluxIQ Core t475). Absent when the read was given no records.
   */
  items?: string[];
};
