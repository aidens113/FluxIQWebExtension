// What a revocation of a document's content script is made of: the epoch work
// in flight checks, the page-free refusal and error it ends in, the fence on
// every reply (`fence.ts`) and the disposers a revocation runs. The background's
// one message (`shared/own-pages/revoked-message.ts`) is acted on by
// `../lifecycle/suspend-content.ts`, which discards what the script holds.

export { revokedEpoch } from "./epoch";
export { ContentRevokedError } from "./error";
export { revokedFence } from "./fence";
export { contentInstalls } from "./installs";
export { contentRevokedRefusal } from "./refusal";
