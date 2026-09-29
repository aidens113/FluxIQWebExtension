// What a panel relay needs from the rest of the background worker: one call to
// a Core program endpoint, already carrying the pairing token, and the project
// this browser's session belongs to. Named once so the conversation relay and
// run control take the same seam, and a test hands both the same fake.

import type { PanelRelayResponse } from "../../shared/protocol";

export type PanelRelayContext = {
  /** POSTs `payload` to the Automation Studio endpoint with the pairing token. */
  readonly call: (endpoint: string, payload: Record<string, unknown>) => Promise<PanelRelayResponse>;
  /** The project FluxIQ last said this browser's session belongs to. */
  readonly projectId: () => string | null | undefined;
};
