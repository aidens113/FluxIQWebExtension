// The fact check (plan B1): a batch of claims about the page, answered in one
// round trip with no wait, each `true`, `false` or `unknown`. The request and
// answer shapes, the readers both ends rebuild them through, and the gateway
// action type they travel under. Not a Flow action: see `request.ts`.
export * from "./answer";
export * from "./answer-value";
export * from "./request";
export * from "./request-value";
