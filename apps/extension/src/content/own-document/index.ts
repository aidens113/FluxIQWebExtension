// The content script's own-page decision: FluxIQ's own page refuses every
// command and pushes nothing (`shared/own-pages/`, `background/tab-gate/`).

export { createOwnDocumentCheck } from "./check";
export type { OwnDocumentCheck, OwnDocumentCheckDeps, OwnDocumentVerdict } from "./check";
export { guardedCommandListener } from "./guard";
export type { ContentAnswer, ContentRoute } from "./guard";
export { ownDocument } from "./document";
