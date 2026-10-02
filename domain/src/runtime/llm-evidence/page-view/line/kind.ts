// The kind word a chosen line prints (t223, "Kinds"), shared by the view's own
// writer (`./render.ts`) and the line facts a call's result compares
// (`./facts.ts`), so the two cannot disagree on what a line is.

import { webLlmElementKind } from "../element";
import type { WebLlmViewLine } from "../view-line";

/**
 * The kind a line prints: `img` for an image line, otherwise the element's
 * kind. A delegate (`./choice.ts`) holds a control and gets the line a
 * non-control gets, so it is not called `clickable`.
 */
export function webLlmLineKind(line: WebLlmViewLine): string | undefined {
  if (line.role === "image") return "img";
  const kind = webLlmElementKind(line.element);
  return kind === "clickable" && line.role !== "control" ? undefined : kind;
}
