// Top-level result members declared to Core as one independent view group.
// The domain owns which members describe the observed page; Core owns their
// model-context projection. Non-view metadata stays outside this declaration.
// Both element-packet and text-page forms use this same group.

/** The top-level keys of a web result that are a view of the page. */
export const WEB_LLM_OBSERVED_STATE_KEYS: readonly string[] = Object.freeze([
  // `web-llm-evidence.v2`: the elements, and the lists that name them by handle.
  "elements",
  "dialogs",
  "blockedBy",
  // `web-llm-page.v3`: the page as one text.
  "page"
]);
