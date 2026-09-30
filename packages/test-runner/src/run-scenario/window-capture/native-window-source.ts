import type { CaptureSource } from "./capture-first-available.js";
import { findBrowserProcess } from "./find-browser-process.js";
import { parseProcessList } from "./parse-process-list.js";
import { runWindowCaptureHelper, type WindowCaptureHelperFailure } from "./run-window-capture-helper.js";

/** The compiled helper, or why there is none; settled once per adapter and never rejected. */
export type SettledHelper = { path: string } | { error: unknown };

export type NativeWindowSourceInput = {
  helper: Promise<SettledHelper>;
  profileDir: string;
  quality: number;
  /** The helper runner; a test injects its own. */
  run?: typeof runWindowCaptureHelper;
};

/** Exit code the helper gives when the process owns no visible window. */
const NO_WINDOW = 2;

/**
 * Photographs this run's own Chromium window -- with the side panel, a docked
 * panel popup and the page overlay in it -- through the Windows helper.
 *
 * The browser process is looked up by the run's profile directory once and
 * remembered; a capture that finds no window under it forgets it, so the next
 * capture looks again rather than photographing nothing forever.
 */
export function nativeWindowSource(input: NativeWindowSourceInput): CaptureSource {
  const run = input.run ?? runWindowCaptureHelper;
  let pid: number | undefined;
  return {
    name: "windows-print-window",
    capture: async signal => {
      const helper = await input.helper;
      if ("error" in helper) throw helper.error;
      pid ??= findBrowserProcess(parseProcessList((await run(helper.path, ["processes"], signal)).toString("utf8")), input.profileDir);
      if (pid === undefined) throw new Error("No browser process was launched on this run's profile directory");
      try {
        return await run(helper.path, ["capture", String(pid), String(input.quality)], signal);
      } catch (error) {
        if ((error as Partial<WindowCaptureHelperFailure>).exitCode === NO_WINDOW) pid = undefined;
        throw error;
      }
    },
  };
}
