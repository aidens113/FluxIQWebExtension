// The sandboxed snapshot page (traces and offline trials, P5 tier 2): the
// extension's own content code run for one action over one recorded page
// snapshot, with page scripts and the network off, behind the domain's
// `WebSnapshotPage` port.

export { openWebSnapshotPage } from "./open-web-snapshot-page.js";
export { loadExtensionContentCode } from "./extension-content-code.js";
export type { PlaywrightWebSnapshotPage, SnapshotBrowserChannel, SnapshotContentCode, WebSnapshotPageOptions } from "./page-options.js";
