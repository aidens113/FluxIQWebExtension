import { rm } from "node:fs/promises";
import path from "node:path";

/**
 * Removes the service workers a Chromium profile has stored, so the extension
 * loaded into it next runs the background worker that is on disk.
 *
 * **A persistent profile keeps running the first build it ever saw.** Chromium
 * stores an extension's background worker in the profile (`Default/Service
 * Worker`) and, on a later launch with `--load-extension` from the same path,
 * starts that stored copy -- even when every file on disk has changed, and even
 * when the manifest's `version` has. The content scripts, the extension pages
 * and the manifest are read fresh; only the worker is old. Measured on
 * 2026-10-06 with Playwright's Chromium: a worker stamped A, then the files
 * stamped B, C and D across three more launches of the same profile, and the
 * worker answered A every time (manifest version bumped included); with this
 * directory removed before the launch it answered the build on disk.
 * `chrome.runtime.reload()` is no remedy: on an extension loaded from the
 * command line it unloaded the extension, and the profile came back without it.
 *
 * What that cost: live run `run-muxky0df-c9839389` (lane C, persistent
 * workspace `t274-c`) refused every Next page with `node_not_runnable_here`.
 * The gateway command was `web.dom.next_page`, and the worker that mapped it was
 * a build from before that action existed (`3ac340bc`, 2026-10-06), whose
 * `normalizeWebAutomationActionType` answers an unknown type with
 * `UNSUPPORTED_TYPE` -- while the fresh content script beside it could have
 * run it. Every background change since that profile was made was invisible to
 * the runs that used it.
 *
 * Only the profile's service-worker store goes: cookies, storage and sign-ins
 * stay, which is what a persistent workspace is kept for. A site's own service
 * worker registers again when its page next loads. A profile that has none --
 * every fresh one -- is left as it is.
 */
export async function forgetCachedServiceWorkers(userDataDir: string): Promise<void> {
  await rm(path.join(userDataDir, "Default", "Service Worker"), { recursive: true, force: true });
}
