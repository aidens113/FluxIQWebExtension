// `web.browser.download`: wait for a browser download to finish.
//
// Downloads are observable only through `chrome.downloads`, in the background
// worker. The permission is declared in the three manifests; when a build lacks
// it the action fails as a capability refusal rather than hanging until its
// timeout, so the reason is visible in the result instead of being inferred
// from a wait that never ended.
//
// The wait looks slightly into the past. A Flow clicks a link and then waits,
// which are two actions: a download that finished in the moment between them
// still satisfies the wait. The window is short and bounded, so a file left by
// an earlier run cannot pass for this one.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { workerActionResult, workerBlockedFailure, workerTimeoutFailure } from "./action-results";
import { downloadRequestForAction } from "./command-options";

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30_000;
const MIN_DOWNLOAD_TIMEOUT_MS = 1_000;
const MAX_DOWNLOAD_TIMEOUT_MS = 120_000;
/** How far before the wait a completed download still counts. */
const DOWNLOAD_LOOKBACK_MS = 15_000;
const DOWNLOAD_POLL_MS = 500;

/** The fields of a download this module judges, so the choice is testable without a browser. */
export type CompletedDownload = {
  filename: string;
  state: string;
  endTime?: string | undefined;
  exists?: boolean | undefined;
};

export async function runBrowserDownloadAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  const request = downloadRequestForAction(action);
  const expected = request.filename !== undefined
    ? `a completed download named ${request.filename}`
    : "a completed download";
  const downloads: typeof chrome.downloads | undefined = chrome.downloads;
  if (!downloads) {
    const actual = "the downloads permission is not granted";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "This build cannot observe downloads: the downloads permission is not granted.",
      validation: { status: "failed", expected, actual },
      // `ACTION_REJECTED`, and the missing permission is named in `actual`: the
      // set has one code for a refusal, not one per reason.
      failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual })
    });
  }
  const timeoutMs = clampTimeout(request.timeoutMs);
  const found = await waitForCompletedDownload(downloads, request.filename, startedAt - DOWNLOAD_LOOKBACK_MS, timeoutMs);
  if (found === undefined) {
    const actual = `no matching download completed within ${timeoutMs} ms`;
    return workerActionResult(action, startedAt, {
      status: "timed_out",
      message: `No download completed within ${timeoutMs} ms.`,
      validation: { status: "failed", expected, actual },
      failure: workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, expected, actual)
    });
  }
  const name = baseName(found.filename);
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: `Download completed: ${name}.`,
    validation: { status: "passed", expected, actual: name }
  });
}

/**
 * Whether a download's file name is the one asked for. The comparison is on the
 * base name only -- the item carries an absolute path -- and accepts the
 * "name (1).ext" form the browser uses when the file already exists.
 */
export function downloadFilenameMatches(filename: string, requested: string | undefined): boolean {
  if (requested === undefined) return true;
  const wanted = baseName(requested).toLowerCase();
  if (wanted === "") return true;
  const actual = baseName(filename).toLowerCase();
  return actual === wanted || withoutUniquifier(actual) === wanted;
}

/** The most recently finished download that matches, ignoring files the browser no longer has. */
export function selectCompletedDownload(
  items: readonly CompletedDownload[],
  requested: string | undefined,
  since: number
): CompletedDownload | undefined {
  const matches = items.filter((item) =>
    item.state === "complete"
    && item.exists !== false
    && downloadFilenameMatches(item.filename, requested)
    && endedAtOrAfter(item.endTime, since));
  return [...matches].sort((left, right) => endTimeMs(right.endTime) - endTimeMs(left.endTime))[0];
}

async function waitForCompletedDownload(
  downloads: typeof chrome.downloads,
  requested: string | undefined,
  since: number,
  timeoutMs: number
): Promise<CompletedDownload | undefined> {
  const immediate = selectCompletedDownload(await searchDownloads(downloads), requested, since);
  if (immediate !== undefined) return immediate;
  return new Promise<CompletedDownload | undefined>((resolve) => {
    let settled = false;
    const listener = (delta: chrome.downloads.DownloadDelta): void => {
      if (delta.state?.current === "complete") void check();
    };
    // The listener answers immediately; the poll covers a completion that
    // arrives without a state delta the worker sees, and the timer bounds both.
    const poll = setInterval(() => void check(), DOWNLOAD_POLL_MS);
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    downloads.onChanged.addListener(listener);

    function finish(found: CompletedDownload | undefined): void {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      downloads.onChanged.removeListener(listener);
      resolve(found);
    }

    async function check(): Promise<void> {
      if (settled) return;
      const found = selectCompletedDownload(await searchDownloads(downloads), requested, since);
      if (found !== undefined) finish(found);
    }
  });
}

async function searchDownloads(downloads: typeof chrome.downloads): Promise<CompletedDownload[]> {
  try {
    const items = await downloads.search({});
    return items.map((item) => ({
      filename: item.filename,
      state: item.state,
      ...(item.endTime !== undefined ? { endTime: item.endTime } : {}),
      ...(item.exists !== undefined ? { exists: item.exists } : {})
    }));
  } catch {
    return [];
  }
}

function clampTimeout(timeoutMs: number | undefined): number {
  const requested = timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  return Math.min(Math.max(requested, MIN_DOWNLOAD_TIMEOUT_MS), MAX_DOWNLOAD_TIMEOUT_MS);
}

function baseName(value: string): string {
  return value.split(/[\\/]/u).at(-1) ?? value;
}

function withoutUniquifier(name: string): string {
  return name.replace(/ \(\d+\)(?=\.[^.]*$|$)/u, "");
}

function endedAtOrAfter(endTime: string | undefined, since: number): boolean {
  if (endTime === undefined) return true;
  const ended = Date.parse(endTime);
  return Number.isNaN(ended) || ended >= since;
}

function endTimeMs(endTime: string | undefined): number {
  const ended = endTime === undefined ? Number.NaN : Date.parse(endTime);
  return Number.isNaN(ended) ? 0 : ended;
}
