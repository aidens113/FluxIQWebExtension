// The recorded-evidence lane (t770-D1): a realistic chat build whose person first records a
// scripted demonstration in the real extension and attaches it to the message that carries the
// task's instruction. The files are the lane's steps in order: choose the demonstration, record it
// through the panel, attach it, judge its own extract (dry run), and after the build check the
// recordings, the saved instruction's link and that no detour was copied.
export * from "./demonstration/index.js";
export * from "./select-demonstration.js";
export * from "./judge-demonstration-extract.js";
export * from "./read-results-pages.js";
export * from "./record-demonstration.js";
export * from "./attach-recorded-demonstration.js";
export * from "./recording-set-change.js";
export * from "./generation-instruction-link.js";
export * from "./detour-copy-fact.js";
