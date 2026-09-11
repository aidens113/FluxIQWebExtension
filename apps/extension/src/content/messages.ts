// Wire-visible message names. `CONTENT_EVENT` and `CONTENT_READY` are read by
// the background worker; the two frame-geometry names are read by the copy of
// this script running in a parent or child frame. Changing a string here
// silently breaks the other side, so they live in one file where that is
// obvious.

export const CONTENT_EVENT = "fluxiq.contentEvent";
export const CONTENT_READY = "fluxiq.contentReady";
export const FRAME_GEOMETRY_REQUEST = "fluxiq.frameGeometryRequest";
export const FRAME_GEOMETRY_RESPONSE = "fluxiq.frameGeometryResponse";
