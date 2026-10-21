// The scripts the snapshot page injects: into the content code's isolated
// world, the scroll watch, the runtime stub and the content script bundle, in
// that order and in one script so the order is fixed; into the page's own
// world, the page-world bundle, as the manifests' `world: "MAIN"` entry does.
// Every one is named `fluxiq-snapshot-*`, which is how the script count tells
// them from a page script.

import { installSandboxRuntimeStub } from "./sandbox-runtime-stub.js";
import { installScrollWatch } from "./scroll-watch.js";

const HARNESS_GLOBAL = "__fluxiqSnapshotPage";
const SCROLL_GLOBAL = "__fluxiqSnapshotScrolls";

export type ContentWorldSource = Readonly<{
  /** The isolated world's script. */
  source: string;
  /** Where the runtime stub's `sent` and `deliver` live in the isolated world. */
  harnessGlobal: string;
  /** Where the scroll watch's `pastEnd` count lives in the isolated world. */
  scrollGlobal: string;
  /** The page world's script for a page-world bundle. */
  pageWorld(bundle: string): string;
}>;

export function contentWorldSource(contentScript: string): ContentWorldSource {
  const source = [
    `(${installScrollWatch.toString()})(${JSON.stringify(SCROLL_GLOBAL)}, globalThis);`,
    `(${installSandboxRuntimeStub.toString()})(${JSON.stringify(HARNESS_GLOBAL)}, globalThis);`,
    contentScript,
    "//# sourceURL=fluxiq-snapshot-content.js",
    ""
  ].join("\n");
  return {
    source,
    harnessGlobal: HARNESS_GLOBAL,
    scrollGlobal: SCROLL_GLOBAL,
    pageWorld: (bundle) => `${bundle}\n//# sourceURL=fluxiq-snapshot-page-world.js\n`
  };
}
