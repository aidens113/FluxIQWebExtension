// The one rule for an exact URL pathname, which is how a recording names a tab
// or a child frame: tab and frame ids do not survive to a replay, origins differ
// run to run, and a query may carry tokens.
//
// The domain applies it where a recorded path becomes a node parameter
// (`payloads.ts`) and where that parameter is lifted onto the action command
// (`client/gateway-action-parameters.ts`). The extension's readers of the
// lifted field import it rather than restating it, so a path the domain would
// refuse is never one the page acts on.

/**
 * The value, when it is an exact URL pathname: a string that begins with a
 * single `/` and holds no query (`?`) or fragment (`#`). Anything else is
 * undefined, a full URL included. A path is refused rather than trimmed out of
 * something that is not one, so no origin or query can pass as a path.
 *
 * A leading `//`, or `/\`, which a URL parser reads the same way, is refused
 * too: it is a protocol-relative URL whose first segment is a host, so without
 * this a host would pass as a path.
 */
export function webAutomationUrlPath(value: unknown): string | undefined {
  return typeof value === "string" && /^\/(?![/\\])[^?#]*$/u.test(value) ? value : undefined;
}
