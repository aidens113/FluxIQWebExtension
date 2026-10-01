// The compact page view (t223): a structured page packet written as the lines
// a model reads -- `web-llm-page.v3` -- and the pieces it is written from, so a
// search over the page describes an element exactly as the view does.

export * from "./element";
export { webLlmPageHeader } from "./header";
export { chosenWebLlmLines } from "./line-choice";
export { renderedWebLlmLines } from "./line-render";
export { webLlmLinkRepeats } from "./link-repeats";
export { webLlmLinkWriter, type WebLlmLinkWriter } from "./link-writer";
export { webLlmPageText } from "./page-text";
export { webLlmPageTree, type WebLlmPageTree } from "./page-tree";
export { publishedWebLlmPage, type WebLlmPublishedPage } from "./published-page";
export { webLlmPageRetentionKey } from "./retention-key";
export { WEB_LLM_PAGE_SCHEMA_VERSION } from "./schema-version";
export { webLlmStructureMarkers } from "./structure-markers";
export type { WebLlmViewLine } from "./view-line";
export { mergedWebLlmFragments } from "./fragment-merge";
