// The page's list extraction engine: normalizing each field of a
// `web.dom.extract_list` request, reading it off an item, moving through the
// list's pages, and the reader that puts them together.
// `action-runtime/execute-action.ts` grants `extractList` to the verbs.
//
// And the other direction: inferring the request itself from an element the
// user picked (C4). `message-handler.ts` answers `extraction.propose` with it,
// and the picker (X4) reuses the same proposal.

export { extractList } from "./list-reader";

export type { ExtractedListRecord, ListExtractionOptions, ListExtractionOutcome } from "./list-reader";

export { inferListFromElement } from "./infer-list";

// And without a pick: the domain's authoring runtime asks `capture_snapshot`
// to detect a structure around an element it names, or the page's largest.
export { detectStructure } from "./detect-structure";
