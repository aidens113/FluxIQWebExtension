// The background worker's action runner, exposed on an extension page so a
// spec can call it.
//
// `src/runtime/` is the half of the extension that acts on the *browser*
// rather than on a document -- navigate, tab, download -- and nothing in the
// e2e tree could reach it: an action reaches the runner only from the gateway
// socket, and the background bundle exports nothing. So the one verb whose
// whole job is to move the browser had no live coverage at all, and a navigate
// that moved nothing reported success for as long as that was true.
//
// This entry is bundled by `harness.ts` and evaluated in an extension page,
// which holds the same `chrome.tabs` and `chrome.webNavigation` the service
// worker does. What it is not is the service worker: this copy of the module
// keeps its own automation-tab memory, separate from the running extension's,
// which is what keeps a spec's navigations from disturbing it.

import { forgetAutomationTab, runBrowserActionCommand, setAutomationTab } from "../../src/runtime";
import type { BrowserActionCommand, BrowserActionResult } from "../../src/shared/protocol";

/** The global the bundle installs. `harness.ts` is the only reader. */
const HARNESS_GLOBAL = "__fluxiqRuntimeHarness";

export type RuntimeHarnessRun = {
  result: BrowserActionResult;
  tabId?: number | undefined;
  frameId?: number | undefined;
};

export type RuntimeHarnessApi = {
  /** Runs one command through `runBrowserActionCommand`, as the command router does. */
  run(action: BrowserActionCommand, options: { activeTabId?: number }): Promise<RuntimeHarnessRun>;
  /** Forgets every driven tab, and points the runner at `tabId` when one is named. */
  reset(tabId?: number): void;
};

const api: RuntimeHarnessApi = {
  async run(action, options) {
    const run = await runBrowserActionCommand({
      action,
      ...(options.activeTabId === undefined ? {} : { activeTabId: options.activeTabId }),
      attachTabForRecording: () => Promise.resolve()
    });
    return { result: run.result, tabId: run.tabId, frameId: run.frameId };
  },
  reset(tabId) {
    forgetAutomationTab();
    if (tabId !== undefined) setAutomationTab(tabId);
  }
};

(globalThis as unknown as Record<string, RuntimeHarnessApi>)[HARNESS_GLOBAL] = api;
