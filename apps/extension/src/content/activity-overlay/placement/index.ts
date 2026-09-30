// Where the activity overlay sits on the page: a corner that covers no fixed
// part of the page, or a small dot when every corner is busy
// (`choose-placement.ts`), kept up to date as the page changes
// (`placement-keeper.ts`).

export { anchorStyle } from "./anchor-style";
export { choosePlacement, type OverlayAnchor, type OverlayPlacement, type PlacementInput, type PointCover } from "./choose-placement";
export { pageProbe } from "./page-probe";
export { PlacementKeeper, type PlacementKeeperOptions } from "./placement-keeper";
