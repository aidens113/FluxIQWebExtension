// Whether the frame a read reached is the frame a step named by id (t1062).
//
// A browser gives a frame a new id each time its document loads, so the id a
// build saw on a step names another frame, or none, once a later attempt has
// reloaded the page. A step in a child frame whose document has an http(s) path
// therefore names it by that path (`browserFrameUrlPath`, `output-nodes/
// frame-parameters.ts`), and the extension sends the read to the one child frame
// at that path, using the id only to break a tie between frames at one path
// (`apps/extension/src/runtime/frame-address.ts`). So where a path was named the
// path is what proves the frame, checked beside this, and any id agrees; only a
// frame named by its id alone must have that id.

/** Whether `actual` is the frame asked for by `requestedId`, given whether the request also named the frame's path. */
export function webFrameIdAgrees(requestedId: unknown, requestedPath: unknown, actual: number | undefined): boolean {
  return requestedId === undefined || requestedPath !== undefined || requestedId === actual;
}
