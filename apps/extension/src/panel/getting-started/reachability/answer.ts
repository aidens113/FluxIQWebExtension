/** What a FluxIQ's discovery document said, or that it did not answer with a valid one. */
export type DiscoveryAnswer = { readonly found: true; readonly gatewayUrl: string } | { readonly found: false };
