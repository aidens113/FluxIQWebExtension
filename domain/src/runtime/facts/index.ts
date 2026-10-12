// The host's fact evaluation (plan B1, Core C9): Core's fact conditions turned
// into literal claims and answered by the page in one round trip, with no
// wait, each `true`, `false` or `unknown`. The host runtime offers it as
// `factEvaluator` under the capability `fact-evaluation`.
export * from "./condition";
export * from "./evaluate";
export * from "./query";
