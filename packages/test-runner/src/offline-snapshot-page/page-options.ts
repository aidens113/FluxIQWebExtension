// What the Playwright snapshot page is opened with, and what it hands back:
// the domain's `WebSnapshotPage` port plus `close()` for the browser it owns.

import type { Browser } from "@playwright/test";
import type { WebAutomationActionCommand, WebSnapshotPage } from "@fluxiq-web-extension/domain/node";

/**
 * The extension's own built content code, as the sandbox runs it: the content
 * script bundle (`content/index.js`), the page-world bundle
 * (`page-world/index.js`) the manifests inject into the page's own world, and
 * the background's `executeAction` builder
 * (`domain/src/client/execute-action-message.ts`, `executeActionMessage`),
 * passed in rather than restated so an action reaches the content code exactly
 * as the background sends it to a tab.
 */
export type SnapshotContentCode = Readonly<{
  contentScript: string;
  pageWorldScript: string;
  actionMessage(action: WebAutomationActionCommand, frameId: number | undefined): unknown;
}>;

/** Chrome unless `msedge` is chosen; both are Chromium, which the sandbox's CDP proofs need. */
export type SnapshotBrowserChannel = "chrome" | "msedge";

export type WebSnapshotPageOptions = Readonly<{
  content: SnapshotContentCode;
  /** The installed browser to launch; `chrome` by default. Ignored when `browser` is given. */
  channel?: SnapshotBrowserChannel | undefined;
  /** Launch headless; `true` by default. A headed check passes `false`. */
  headless?: boolean | undefined;
  /** A browser the caller owns and closes; the page then launches none. */
  browser?: Browser | undefined;
}>;

/** The sandboxed snapshot page: the domain's port, and `close()` for the browser it launched (none when one was given). */
export type PlaywrightWebSnapshotPage = WebSnapshotPage & Readonly<{ close(): Promise<void> }>;
