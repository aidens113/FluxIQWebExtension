// The Playwright implementation of the domain's `WebSnapshotPage` port
// (`domain/src/runtime/offline-reads/snapshot-page.ts`; trace plan P5, D34):
// each `evaluate` runs the extension's own content code for one action over
// one recorded snapshot in a fresh offline context (`evaluate-over-snapshot.ts`).
// Chrome by default, Edge by `channel: "msedge"`; the browser is launched on the
// first evaluation that needs one, and `close()` closes only a browser this
// page launched.

import { chromium, type Browser } from "@playwright/test";
import { evaluateOverSnapshot } from "./evaluate-over-snapshot.js";
import type { PlaywrightWebSnapshotPage, WebSnapshotPageOptions } from "./page-options.js";

export function openWebSnapshotPage(options: WebSnapshotPageOptions): PlaywrightWebSnapshotPage {
  let launched: Promise<Browser> | undefined;
  const browser = (): Promise<Browser> => {
    if (options.browser) return Promise.resolve(options.browser);
    launched ??= chromium.launch({ channel: options.channel ?? "chrome", headless: options.headless ?? true });
    return launched;
  };
  return {
    evaluate: (snapshot, action) => evaluateOverSnapshot(browser, options.content, snapshot, action),
    close: async () => {
      if (launched) await (await launched).close();
    }
  };
}
