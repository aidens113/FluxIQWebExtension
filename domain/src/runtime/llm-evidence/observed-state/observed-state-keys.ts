// The keys of a web result that are the page, declared once to Core.
//
// Core shows each decision the newest page whole and, in every earlier result,
// replaces exactly these keys with `supersededBy`, the call whose result
// replaced that page, keeping the rest -- what the step did, what it read,
// what changed, why it was refused (`AS/runtime/llm/context-window.ts`, B1).
// Core knows nothing about pages, so the domain says which keys are one, as it
// says which are raw payload (`../denied-keys.ts`). Without it every earlier
// page rode whole in every later request: live run `run-mup2i28c-6c7fc209` sent
// three of them in its fifth decision, 214,853 input tokens.
//
// Both forms of the page are named, so the declaration holds on either side of
// the compact view (t223): the `web-llm-evidence.v2` packet's element list and
// the two lists that name its elements, and the `web-llm-page.v3` page text.
// Everything else -- `location`, `ok`, `status`, `pageChanged`, `control`, a
// read's rows -- is what the step did or where it left the tab, and stays.

/** The top-level keys of a web result that are a view of the page. */
export const WEB_LLM_OBSERVED_STATE_KEYS: readonly string[] = Object.freeze([
  // `web-llm-evidence.v2`: the elements, and the lists that name them by handle.
  "elements",
  "dialogs",
  "blockedBy",
  // `web-llm-page.v3`: the page as one text.
  "page"
]);
