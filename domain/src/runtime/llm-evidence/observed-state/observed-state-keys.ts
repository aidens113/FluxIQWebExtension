// Top-level result members declared to Core as one independent view group.
// The domain owns which members describe the observed page; Core owns their
// model-context projection. Non-view metadata stays outside this declaration.
//
// The keyed page view (`pageView`, `web-llm-page.v4`) is one of them. Core reads
// these keys beyond the model's window: the page the judge is told a run started
// and ended on (`result-summary.ts`, `startedOn`; the end-view reader), and the
// view a build test's step observation leaves out. Without it the judge held a
// run it had confirmed as unconfirmed, `judge_evidence.before_state_missing`
// (t1036 Lab run `run-mwvsbihx-e60f9f0f`). In the model's window Core's page
// channel delivers it instead (t1036, D1-D7): the window takes the channel's
// member out of this group (`context-window.ts`), so it is never a whole-page
// tail there. The element-packet form (`web-llm-evidence.v2`) declares its
// members here too.

/** The top-level keys of a web result that are a view of the page. */
export const WEB_LLM_OBSERVED_STATE_KEYS: readonly string[] = Object.freeze([
  // `web-llm-evidence.v2`: the elements, and the lists that name them by handle.
  "elements",
  "dialogs",
  "blockedBy",
  // `web-llm-page.v4`: the keyed page view (`../page-view/keyed-view.ts`).
  "pageView",
  // Passive semantic state must accompany the view through Core's end/witness
  // projection; it contains no handles, selectors, geometry or page text.
  "judgeState"
]);
