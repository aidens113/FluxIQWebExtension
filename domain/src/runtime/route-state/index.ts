// Barrel for the state a web Flow's Router decides on: the paths it may test,
// the projection of an evidence packet that fills them, and the content-free
// signature of that state a Flow node keeps, with the comparison Core asks of
// two of them, and the effect of a node's step with whether it already holds
// (t243).
export * from "./paths";
export * from "./project";
export { WEB_ROUTE_SIGNATURE_FORMAT } from "./signature-format";
export { webAutomationRouteSignature } from "./signature";
export { compareWebAutomationRouteSignatures } from "./compare-signatures";
export * from "./effect";
