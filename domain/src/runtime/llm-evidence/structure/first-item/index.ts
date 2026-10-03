// Where a detected list's columns are in the page view: the handle of each
// column's element in the first item that has it (`./locate.ts`), found by walking
// the detection's selectors over its own capture (`./tree.ts`, `./chain.ts`,
// `./compound.ts`).

export { webLlmFirstItemHandles, type WebLlmFirstItemPages } from "./locate";
