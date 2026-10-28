// Where a control sits, as the opaque tokens FluxIQ Core's action declaration
// takes (Core t475): the token itself, and the tokens of a shown handle.
export { webTargetSpot } from "./target";
export { webControlSpotToken } from "./token";
export { webResetResource } from "./resource";
export { webResetCollections } from "./collection";
// A stateful control's own place and state, and a read's counts of them (L1 reset settlement).
export { webControlPlace } from "./place";
export { webControlState } from "./state";
export { webControlStates } from "./states";
// Every shown value of a read by its own place (t772 value witness).
export { webValueStates } from "./values";
export { isWebStatefulControl } from "./stateful";
export { webControlRole } from "./role";
