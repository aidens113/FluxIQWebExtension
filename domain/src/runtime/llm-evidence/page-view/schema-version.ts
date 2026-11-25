// The published page's version. `.v3` followed the structured packet's `.v2`
// (`../sanitize.ts`): what left the domain for a model became one string of
// lines, `page`. `.v4` (t1036) carries the same lines keyed, as `pageView`, so
// Core can deliver the lines that changed; a reader of any can tell which it
// holds.

/** The schema of a page as a model is shown it (t223, keyed since t1036). */
export const WEB_LLM_PAGE_SCHEMA_VERSION = "web-llm-page.v4" as const;
