// Where a detected list's columns are in the page view: the handle of each
// column's element in the first item that has it (`./locate.ts`), found by walking
// the detection's selectors over its own capture (`./walk.ts`, over `./tree.ts`,
// `./chain.ts` and `./compound.ts`); and that element itself, which a column's
// sample and readable label are read from (`../field-sample.ts`). The walk is
// exported too, for each item's marks and identity (`../list-items/`).

export { webLlmFirstItemElements, webLlmFirstItemHandles, webLlmFirstItemLines, type WebLlmFirstItemPages } from "./locate";
export { webLlmCaptureWalk, type WebLlmCaptureWalk } from "./walk";
export type { WebLlmTreeNode } from "./tree";
