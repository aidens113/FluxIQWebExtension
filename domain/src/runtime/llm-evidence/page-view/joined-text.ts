// A page view read as the one text a model reads (t1036): every line's text,
// joined by "\n". For a view without extra lines this is exactly the page
// string published before keyed lines; a full capture's extra lines are part
// of the text it showed.

import type { WebLlmPageLine } from "./keyed-line";

/** The text of a view's lines. */
export function webLlmPageViewText(view: { readonly lines: readonly Pick<WebLlmPageLine, "text">[] }): string {
  return view.lines.map((line) => line.text).join("\n");
}
