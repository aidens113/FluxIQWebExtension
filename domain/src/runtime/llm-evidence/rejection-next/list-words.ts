// A read that named its list by words no line of the page shows (t1038, D13).
//
// A read may name its list by the words of a line in it or above it
// (`../node-run/list-read/own-detection.ts`). When no line of the page view
// shows them, nothing is read: the page's largest list would be a guess at what
// was meant. The refusal is t1013's `list_not_on_page`, told apart from a Next
// page's and a saved read's by its code in `instead`, which carries no word of
// the page, so a repeat of the refusal says the same (`../repeated-refusal.ts`).

/** The code the refusal carries in `instead`. */
const WORDS_NOT_SHOWN = "web.list.words_not_shown";

export const webLlmListWords = {
  /** The refusal's code (header). */
  code: WORDS_NOT_SHOWN,
  /** Whether `instead` says a read's words named no line of the page. */
  isRefused(instead: readonly string[] | undefined): boolean {
    return (instead ?? []).includes(WORDS_NOT_SHOWN);
  },
  /** What to do next: name the list by a line the page view does print. */
  next: "Nothing was read: no line of this page's view shows the words this read named its list by. "
    + "Name the list by the handle of a line inside it, or of the heading above it, as the page view prints them; "
    + "or name nothing, and the read takes the page's largest list."
};
