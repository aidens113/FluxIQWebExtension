/** The FluxIQ the extension looked for: where, and whether a valid FluxIQ answered there. */
export type ServerFinding = {
  /** The web address that was asked, as an origin. */
  readonly origin: string;
  /** Its host and port, as a person reads them ("127.0.0.1:3100"). */
  readonly host: string;
  readonly found: boolean;
  /** The connection address its discovery document names, when one answered. */
  readonly gatewayUrl?: string | undefined;
};
