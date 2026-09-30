import { ensureWindowCaptureHelper, parseProcessList, runWindowCaptureHelper, type BrowserProcessEntry } from "../run-scenario/index.js";
import type { ChatBrowser } from "./types.js";

/**
 * A photograph of every visible window the browser process owns, composited
 * as they stand on screen, through the Lab's Windows capture helper
 * (`run-scenario/window-capture`). It shows what a person watching sees: the
 * page with the side panel beside it, or the page with the popup over it,
 * which a Playwright screenshot of one page cannot.
 *
 * Chrome's browser process is the one launched with `--user-data-dir=<profile>`
 * and no `--type=`; Firefox's is the one launched with `-profile <profile>`
 * that is not a `-contentproc` child. Resolves JPEG bytes, or undefined with
 * the reason when there is no picture.
 */
export async function captureBrowserWindows(browser: ChatBrowser, profileDir: string): Promise<{ bytes?: Uint8Array; reason?: string }> {
  try {
    const helper = await ensureWindowCaptureHelper();
    const signal = AbortSignal.timeout(15_000);
    const processes = parseProcessList((await runWindowCaptureHelper(helper, ["processes"], signal)).toString("utf8"));
    const pid = browserPid(processes, browser, profileDir);
    if (pid === undefined) return { reason: `no ${browser} process was found on ${profileDir}` };
    return { bytes: await runWindowCaptureHelper(helper, ["capture", String(pid), "88"], signal) };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
}

function browserPid(processes: readonly BrowserProcessEntry[], browser: ChatBrowser, profileDir: string): number | undefined {
  const wanted = normalized(profileDir);
  const candidates = processes.filter(entry => {
    const line = normalized(entry.commandLine);
    if (!line.includes(wanted)) return false;
    return browser === "chrome" ? !/(?:^|\s|")--type=/u.test(entry.commandLine) : !/-contentproc\b/u.test(entry.commandLine);
  });
  const pids = new Set(candidates.map(entry => entry.pid));
  return (candidates.find(entry => !pids.has(entry.parentPid)) ?? candidates[0])?.pid;
}

function normalized(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}
