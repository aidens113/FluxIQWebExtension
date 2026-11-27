// The route a step's recorded effect went to, and whether an address is on it
// (t1083). Read from the effect `../route-state/effect/sign.ts` signs: `path`,
// the path shape it went to, present only when the step moved; `destination`,
// the address it went to, signed beside `path` since t1083.
//
// A route is an address without its `?` query (user, 2026-11-25: a page address
// is its URL "not including the ? params"). With a `destination`, an address is
// on the route when it resolves to the same origin and path. An effect signed
// before t1083 has only the shape, so an address is on it when its path has the
// same shape: a shape is all that effect knows.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_EFFECT_FORMAT, webAutomationRouteSignature } from "../route-state";

/** A route an effect went to: its path shape, and its destination where the effect kept one. */
export type WebOwedRoute = {
  /** The path shape's hash, as a route signature writes it. */
  readonly shape: string;
  /** The address the step went to: a path, or an origin and path when it went to another origin. */
  readonly destination?: string;
  /** Whether `address` (an absolute http(s) URL) is on this route. */
  holds(address: string): boolean;
  /** The destination as a whole address, resolved against the page's `address`; nothing without a destination. */
  resolved(address: string): string | undefined;
};

/** The route `effect` went to, or nothing when it moved to no other route or is not an effect this host reads. */
export function webOwedRoute(effect: JsonObject): WebOwedRoute | undefined {
  if (effect.v !== WEB_ROUTE_EFFECT_FORMAT.version || typeof effect.path !== "string") return undefined;
  const shape = effect.path;
  const destination = typeof effect.destination === "string" && effect.destination !== "" ? effect.destination : undefined;
  const resolved = (address: string): string | undefined => {
    if (destination === undefined || !URL.canParse(destination, address)) return undefined;
    const url = new URL(destination, address);
    return url.protocol === "http:" || url.protocol === "https:" ? `${url.origin}${url.pathname}` : undefined;
  };
  return {
    shape,
    ...(destination === undefined ? {} : { destination }),
    resolved,
    holds: (address) => {
      if (!URL.canParse(address)) return false;
      const url = new URL(address);
      // The path shape's hash exactly as a route signature, and so the effect, writes it.
      if (destination === undefined) return webAutomationRouteSignature({ page: { path: url.pathname } }).path === shape;
      return resolved(address) === `${url.origin}${url.pathname}`;
    }
  };
}
