/**
 * The answer to one panel request, already in words (UI audit, section 5,
 * "Contracts pinned by this spec").
 *
 * `value` is the background's reply object for a request that succeeded.
 * `sentence` is what a person reads; `detail` keeps the raw text, shown as a tooltip.
 * `unsupported` means the background answered "Unknown FluxIQ extension
 * message.": this extension build does not handle the message yet, so a view
 * shows its fallback instead of an error.
 *
 * `code` is the background's own failure code when its reply named one (the
 * panel relays answer with a `PanelRelayFailureCode` such as `refused` or
 * `not_paired`), so a view can branch on what failed rather than parse the
 * sentence. Absent when the reply named none.
 *
 * `coreCode` is Core's own refusal code as Core answered it (for example
 * `conversation_run_active`): a short identifier, or absent. It is a separate
 * field because `code` already means the relay's failure, and a `refused`
 * code makes the chat treat the browser as refused, which an ordinary Core
 * refusal is not.
 */
export type PanelResult<T> =
  | { ok: true; value: T }
  | { ok: false; sentence: string; detail?: string; unsupported?: true; code?: string; coreCode?: string };
