// What the page view says about one element, piece by piece: whether it gets a
// line and as what, its kind word, its words, its state tokens and where it is
// on the page. Exported so a search over the page (`web.find_on_page`) prints
// an element exactly as the view would.

export { attributeValue } from "./attribute-value";
export { undoubledWords } from "./doubling";
export { webLlmElementKind } from "./kind";
export { meaningfulWords } from "./meaningful";
export { normalisedWords } from "./normalised";
export { quotedWords } from "./quoted";
export { webLlmStateTokens } from "./state-tokens";
export { webLlmViewTraits, type WebLlmLineRole, type WebLlmViewTraits } from "./traits";
export { webLlmElementWhere, type WebLlmElementWhere } from "./where";
export { webLlmElementWords } from "./words";
