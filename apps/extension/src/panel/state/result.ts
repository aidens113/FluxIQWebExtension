/**
 * The answer to one panel request, already in words (UI audit, section 5,
 * "Contracts pinned by this spec").
 *
 * `value` is the background's reply object for a request that succeeded.
 * `sentence` is what a person reads; `detail` keeps the raw text for Advanced.
 * `unsupported` means the background answered "Unknown FluxIQ extension
 * message.": this extension build does not handle the message yet, so a view
 * shows its fallback instead of an error.
 */
export type PanelResult<T> =
  | { ok: true; value: T }
  | { ok: false; sentence: string; detail?: string; unsupported?: true };
