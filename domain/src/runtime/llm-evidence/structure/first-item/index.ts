// Where a detected list's columns are in the page view: the handle of each
// column's element in the first item that has it (`./locate.ts`), found by walking
// the detection's selectors over its own capture (`./tree.ts`, `./chain.ts`,
// `./compound.ts`); and that element itself, which a column's sample and
// readable label are read from (`../field-sample.ts`).

export { webLlmFirstItemElements, webLlmFirstItemHandles, type WebLlmFirstItemPages } from "./locate";
