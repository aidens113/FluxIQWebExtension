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

// What the wait for the list did, which is the only thing that can tell a read
// that gave up early from one that paid its whole window.
export type { ListWait, ListWaitStop } from "./page-render";

// What a read's `where` conditions did to it, and the rule that a read they
// emptied answers with the rows they rejected rather than with none.
export type { ListExtractionConditionReport } from "./filtered-answer";

export { inferListFromElement } from "./infer-list";

// And without a pick: the domain's authoring runtime asks `capture_snapshot`
// to detect a structure around an element it names, or the page's largest.
export { detectStructure, detectStructureWhenPresent } from "./detect-structure";
