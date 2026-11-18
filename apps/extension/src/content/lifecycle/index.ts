// What starts and stops the content script's page-touching parts: they start
// only once the document is known to be an ordinary page
// (`install-when-ordinary.ts`) and are all taken down by a revocation
// (`suspend-content.ts`).

export { installWhenOrdinary } from "./install-when-ordinary";
export type { ContentInstall, InstallWhenOrdinaryDeps } from "./install-when-ordinary";
export { suspendContent } from "./suspend-content";
