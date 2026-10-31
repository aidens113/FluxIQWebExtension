// Read members declared to Core as an independent held view group. Page-only
// results do not replace these rows. Counts, validation and other read metadata
// remain outside the group; Core owns its model-context projection.
// `extracted` contains kept rows; `rejectedRows` contains rows the conditions
// turned down, and `rejectedRowsNote` explains those rejected rows.

/** The members of a node-run result's `read` that are its rows, as Core's `holder.member` keys. */
export const WEB_LLM_READ_ROWS_KEYS: readonly string[] = Object.freeze([
  "read.extracted",
  "read.rejectedRows",
  "read.rejectedRowsNote"
]);
