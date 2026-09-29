// The unsent draft: the one piece of conversation state the panel keeps (UI
// audit, section 4, principle 6), and only as a per-viewer convenience --
// Firefox destroys its popup on every click outside it, and a half-written
// message should survive that. It lives in this page's `localStorage`, which a
// private window or blocked site data can refuse; that refusal is a
// `DOMException` and costs only the convenience. Anything else is rethrown.

const DRAFT_KEY = "fluxiq.ui.conversationDraft";

/** The stored draft and a way to replace it. */
export type DraftStorage = { read(): string; write(text: string): void };

/** The draft kept in `localStorage`. */
export function draftStorage(): DraftStorage {
  return {
    read() {
      try {
        return globalThis.localStorage?.getItem(DRAFT_KEY) ?? "";
      } catch (error) {
        // Storage refused: there is no kept draft to read, so the box starts empty.
        if (error instanceof DOMException) return "";
        throw error;
      }
    },
    write(text) {
      try {
        if (text === "") globalThis.localStorage?.removeItem(DRAFT_KEY);
        else globalThis.localStorage?.setItem(DRAFT_KEY, text);
      } catch (error) {
        if (!(error instanceof DOMException)) throw error;
        /* best-effort: a draft storage refused is only retyped after reopening the panel */
      }
    }
  };
}
