// Where a step's control sat and which items its page listed, for the state
// diff's `spot` and `items` (t609, FluxIQ Core t598).
export { webStateDiffPlaces } from "./diff";
export { createWebStatePlacesMemo, type WebStatePlacesMemo } from "./memo";
export { webStateSnapshotPlaces, type WebStateSnapshotPlaces } from "./snapshot";
