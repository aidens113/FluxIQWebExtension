// The sentence a refusal's `next` carries, read off its reason and the
// resolver's codes beside it (`./next-sentence.ts`), and the site's wait and
// the tab's return after it on a press refused for now (`./wait-words.ts`), and
// how a read refused for a column its list lacks names the column (`./unknown-column.ts`),
// and how a read whose list is not on its page names where the list was made (`./list-made-on.ts`).

export { webLlmRejectionNext } from "./next-sentence";
export { webLlmRejectionNextWithWait } from "./wait-words";
export { webLlmUnknownColumn } from "./unknown-column";
export { webLlmListMadeOn } from "./list-made-on";
// How a read that named its list by words no line shows is told (`./list-words.ts`, t1038).
export { webLlmListWords } from "./list-words";
// How a select that named no option is told (`./select-option-next.ts`, t1081).
export { WEB_SELECT_OPTION_CODE_PREFIX } from "./select-option-next";
