// What the panel knows about the person's model key, in four words. `unknown` is
// every failed or unreadable answer: it never blocks anyone and never claims anything.

/** `ready` a key is enabled and opens on this browser; `missing` none is enabled; `locked` one is, and this browser cannot open it yet. */
export type ModelKeyReading = "ready" | "missing" | "locked" | "unknown";
