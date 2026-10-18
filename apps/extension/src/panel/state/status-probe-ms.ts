// How often the panel re-reads the status while it waits on the background
// (connecting, pairing, reconnecting). Each read is a runtime message, and any
// message starts a stopped Manifest V3 worker, so a worker that died mid-wait
// is noticed and woken within this many milliseconds (t707 P1).

/** The status re-read interval while the panel waits on the background. */
export const PANEL_STATUS_PROBE_MS = 3000;
