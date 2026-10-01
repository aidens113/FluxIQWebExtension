// The published page's version. `.v3` follows the structured packet's `.v2`
// (`../sanitize.ts`): what leaves the domain for a model is now one string of
// lines, not an element list, and a reader of either can tell which it holds.

/** The schema of a page as a model is shown it (t223). */
export const WEB_LLM_PAGE_SCHEMA_VERSION = "web-llm-page.v3" as const;
