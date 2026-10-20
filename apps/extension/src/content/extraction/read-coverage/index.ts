// What a list read can say about how much of its list it covered, beyond its
// counts: whether a read of one page saw the list go on past it; and, on the
// passive snapshot, how each list or table the page shows goes on.

export { listContinuesPast } from "./list-continues";
export type { ListContinues } from "./list-continues";
export { listWayOn } from "./list-way-on";
export type { ListWayOn } from "./list-way-on";
