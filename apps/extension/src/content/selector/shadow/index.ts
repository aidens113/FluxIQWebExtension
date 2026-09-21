// Addressing an element inside open shadow roots: the host chain the recorder
// writes beside the element's selector (`host-chain.ts`), the roots a replay
// walks that chain to (`scope.ts`), and the point lookup that sees into them
// (`element-from-point.ts`).

export { deepElementFromPoint } from "./element-from-point";
export { shadowHostChain } from "./host-chain";
export { resolveShadowScope } from "./scope";

export type { LookupRoot, ShadowScope } from "./scope";
