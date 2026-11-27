// A step passed over still owes where it went (t1083): the web host's half of
// Core's `reachRouteEffect`. Core decides that a step passed over as never arisen,
// whose recorded effect moved the page, owes that route; this module reads the
// route from the effect (`owed-route.ts`), picks the link on the page that goes
// there (`route-link.ts`), and brings the page there (`reach-route.ts`). The host
// runtime binds it (`../host-runtime.ts`).
export { webOwedRoute, type WebOwedRoute } from "./owed-route";
export { webRouteLinkSelector } from "./route-link";
export { webAutomationReachRouteEffect, type WebRouteReachDispatch } from "./reach-route";
