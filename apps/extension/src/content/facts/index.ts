// The page side of the fact check (plan B1): a batch of claims judged from this
// document in one synchronous pass, each `true`, `false` or `unknown`.
// `judge.ts` holds every rule, over the read surface `fact-page.ts` declares;
// `dom-page.ts` answers that surface from the live document by the reads
// `web.dom.assert` and the action resolver already use.
export { domFactPage } from "./dom-page";
export { evaluateFactBatch } from "./evaluate";
export { judgeFact } from "./judge";

export type { FactDialog, FactDocument, FactElement, FactPage, FactReading, FactResolution } from "./fact-page";
