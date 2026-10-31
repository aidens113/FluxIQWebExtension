// The list extraction output node's own parts: what it saves, what it
// dispatches, how its request is checked, and what a model reads about it.
export * from "./catalog-text";
export * from "./column-match";
export * from "./declared-columns";
export * from "./derived-record-output";
export * from "./dispatch";
export * from "./issues";
export * from "./parameter-contract";
export * from "./parameters";
export * from "./process-issues";
export * from "./reconciled-record-output";
export * from "./record-output";
export * from "./record-output-process";
export * from "./reference-now";
export * from "./records-path";
// How its rows come out, declared to Core in its definition's metadata (t751).
export * from "./rows-order";
export * from "./stored-columns";
export * from "./swapped-name";
export { webAutomationDedupeLinkIdentity } from "./dedupe-link-identity";
