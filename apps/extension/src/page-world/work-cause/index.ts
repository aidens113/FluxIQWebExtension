// What caused the work the page is doing (t1094): the scheduled lineage it runs
// in, and the armed press whose work it is. Read by the request count to tell a
// press's own requests from the page's background traffic.
export { pressOwners } from "./press-owners";
export { workOrigins } from "./work-origins";

export type { PressOwnersReader } from "./press-owners";
