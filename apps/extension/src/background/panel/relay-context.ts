// What a panel relay needs from the rest of the background worker: one call to
// a Core program endpoint, already carrying the pairing token, the project
// this browser's session belongs to, and the page the person is looking at.
// Named once so the conversation relay and run control take the same seam, and
// a test hands both the same fake.

import type { PanelRelayResponse } from "../../shared/protocol";

export type PanelRelayContext = {
  /** POSTs `payload` to the Automation Studio endpoint with the pairing token. */
  readonly call: (endpoint: string, payload: Record<string, unknown>) => Promise<PanelRelayResponse>;
  /**
   * The project this browser's session belongs to: the one FluxIQ last said,
   * or else the one Core's snapshot names now, as a recording resolves it
   * (`connection/project-context.ts`). A browser just paired has none stored
   * until it records, so without the lookup its chat could not send at all.
   */
  readonly projectId: () => Promise<string | null | undefined> | string | null | undefined;
  /**
   * The active tab's address when it is an http: or https: URL of at most 2048
   * characters (`acceptedPageUrl`); undefined for any other page or on any
   * failure of the check. Rejects when the browser cannot say, and the relay
   * then sends nothing and says why.
   */
  readonly pageLocation: () => Promise<string | undefined>;
};
