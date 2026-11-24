// Where a read's list stands (t1022): the lists a build's own Next page steps
// moved, so their reads stand where the pager took them; the page a read's
// answer says it read; the refusal of a read whose list is not on it; and the
// guard a call makes with them once the page has answered (`./answer-guard.ts`).

export { webNodeListPages, type WebNodeListPages } from "./list-pages";
export { webNodeReadAddress } from "./read-address";
export { webNodeReadElsewhere } from "./read-elsewhere";
export { webNodeListReadGuard, type WebNodeListReadGuardInput } from "./answer-guard";
