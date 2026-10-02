// The view's lines: which elements get one (`./choice.ts`), what kind each is
// (`./kind.ts`), how each is written (`./render.ts`), and the facts a call's
// result compares between two pages (`./facts.ts`).

export { chosenWebLlmLines } from "./choice";
export { webLlmLineFacts, type WebLlmLineFact } from "./facts";
export { webLlmLineKind } from "./kind";
export { renderedWebLlmLines } from "./render";
