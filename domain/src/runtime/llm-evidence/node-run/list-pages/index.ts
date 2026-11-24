// Where a read's list stands (t1022): the lists a build's own Next page steps
// moved, so their reads stand where the pager took them; the page a read's
// answer says it read; and the refusal of a read whose list is not on it.

export { webNodeListPages, type WebNodeListPages } from "./list-pages";
export { webNodeReadAddress } from "./read-address";
export { webNodeReadElsewhere } from "./read-elsewhere";
