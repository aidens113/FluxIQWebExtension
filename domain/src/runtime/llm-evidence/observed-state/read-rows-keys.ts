// The keys of a web result that are a read's rows, declared once to Core
// (t194 w48).
//
// A read's rows are a view of their own: Core shows the newest read's rows
// whole and, in every read a newer read replaced, puts `supersededBy` -- the
// call of the read that replaced it -- in their place inside the read
// (`AS/runtime/llm/context-window.ts`). A click or a page view that follows a
// read never replaces them; only another read does, because only a read's
// rows say what the Flow returns. Live run 13 (`run-muqbzu32-8691a65e`) read
// one list three times while correcting its conditions, and its last request
// carried all three reads whole: 164,577 of its 290,929 characters.
//
// Each key is `read.<member>`: a member of the `read` a node-run result holds
// (`../node-run/run.ts`), which Core replaces inside `read` and nowhere else.
// What stays in a replaced read is its short account -- counts, pages, why it
// stopped, the first rows, and where the rest are (`../node-run/shown-rows/account.ts`)
// -- and `core.recall_result` gives the rows back whole.
//
// `extracted` is every kept row; `rejectedRows` the rows the conditions turned
// down (`../node-run/rejected-rows.ts`); `rejectedRowsNote` the sentence about
// them, which says nothing once they are gone. A click's `read` holds none of
// them, so a click is never mistaken for a read.

/** The members of a node-run result's `read` that are its rows, as Core's `holder.member` keys. */
export const WEB_LLM_READ_ROWS_KEYS: readonly string[] = Object.freeze([
  "read.extracted",
  "read.rejectedRows",
  "read.rejectedRowsNote"
]);
