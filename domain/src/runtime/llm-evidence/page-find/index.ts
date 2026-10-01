// Searching the whole page (t223): `web.find_on_page` finds what the page view
// leaves out -- hidden, off-screen and text-less elements, and any attribute --
// and `web.describe_element` prints everything the capture holds about one.

export { webLlmDescribeElement, type WebLlmDescribeResult } from "./description";
export { WEB_LLM_DESCRIBE_SCHEMA_VERSION } from "./description-schema-version";
export { webLlmFindQuery } from "./query";
export { runWebDescribeElement } from "./run-description";
export { runWebFindOnPage, type WebFindOnPageRun } from "./run";
export { WEB_LLM_FIND_SCHEMA_VERSION } from "./schema-version";
export { webLlmFindOnPage, type WebLlmFindResult } from "./search";
