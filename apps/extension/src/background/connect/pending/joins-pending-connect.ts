// A connection request that arrives while one to the same FluxIQ is already
// under way joins it, instead of starting over (t968).
//
// Every `fluxiq.connect` opened a fresh gateway socket, and a fresh socket
// drops the pairing the last one was waiting on. The side panel sends the
// request by itself the moment it finds FluxIQ at the configured address
// (`panel/getting-started/start/view.ts`, `autoConnect`), so any second
// request -- the popup's, a person's, a host's or the Lab's own pairing --
// threw away the approval code the first one was showing: Core answered the
// approval `409`, "The browser disconnected before this pairing was approved",
// for every recovery-matrix case once the panel could reach the run's Core
// (`run-mwohvt8n` follow-up, cases 1 and 14). Two requests for one
// connection are one connection: the second is answered with the status of the
// first, whose code is the one to approve.
//
// Only an identical request joins. A different web or connection address, or a
// managed host's enrolment ticket (which binds this connection to that host),
// starts over as before, and so does any request once the attempt is no longer
// under way (connected, failed, or dropped).

import type { ConnectionState } from "../../../shared/protocol";

/** The states in which a connection attempt is still under way and may be joined. */
const UNDER_WAY: ReadonlySet<ConnectionState> = new Set<ConnectionState>(["connecting", "pairing"]);

/** The addresses a connection is made to. */
export type ConnectAddresses = { gatewayUrl: string; coreApiUrl: string };

/**
 * Whether a connection request should join the attempt already under way:
 * the attempt is connecting or waiting on its approval, the request carries no
 * enrolment ticket, and it asks for exactly the addresses the attempt uses.
 */
export function joinsPendingConnect(state: ConnectionState, current: ConnectAddresses, requested: Partial<ConnectAddresses>, enrolmentTicket: string | undefined): boolean {
  if (!UNDER_WAY.has(state) || enrolmentTicket !== undefined) return false;
  return (requested.gatewayUrl ?? current.gatewayUrl) === current.gatewayUrl && (requested.coreApiUrl ?? current.coreApiUrl) === current.coreApiUrl;
}
