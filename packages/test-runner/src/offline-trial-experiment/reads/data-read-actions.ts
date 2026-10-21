// The reads that take data off a page, between which the P5 gate forms
// changed-read pairs (the P5s survey's definition): a list read and a single
// read. Waits, assertions and the builder's page view are reads too, and are
// evaluated over their own snapshots, but never paired.

export const DATA_READ_ACTIONS: ReadonlySet<string> = new Set(["web.dom.extract_list", "web.dom.extract"]);
