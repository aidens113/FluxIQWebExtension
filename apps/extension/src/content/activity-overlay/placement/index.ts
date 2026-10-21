// Where the activity overlay sits on the page: a corner, or a place moved in
// from its top or bottom edge, that covers the least of the page -- never the
// middle of an edge, always a pill that carries the words, never a dot
// (`choose-placement.ts`) -- kept in place as the page changes and moved only
// when a clearly better place stays better (`placement-keeper.ts`), starting
// each new page where the last one had it (`placement-memory.ts`).

export { anchorStyle } from "./anchor-style";
export { choosePlacement, type OverlayAnchor, type OverlayPlacement, type PlacementInput, type PointCover } from "./choose-placement";
export { pageProbe } from "./page-probe";
export { PlacementKeeper, type PlacementKeeperOptions, type PlacementPage } from "./placement-keeper";
export { browserPlacementMemory, type PlacementMemory } from "./placement-memory";
