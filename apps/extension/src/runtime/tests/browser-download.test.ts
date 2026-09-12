// T1 coverage of browser-download.ts: which download satisfies a wait, and the
// two failures a wait can report. The rules that matter for the first are that
// a file left by an earlier run cannot pass for this one, and that a file the
// browser renamed still counts.
//
// The failures are covered because their codes were `web.download.*`, in no
// set, so nothing downstream could name them. `chrome.downloads` is stubbed --
// absent for the refusal, present and empty for the timeout -- which is exactly
// the two states the module branches on.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../shared/protocol";
import {
  downloadFilenameMatches,
  runBrowserDownloadAction,
  selectCompletedDownload,
  type CompletedDownload
} from "../browser-download";

const since = Date.parse("2026-09-11T10:00:00.000Z");

function download(overrides: Partial<CompletedDownload> = {}): CompletedDownload {
  return {
    filename: "C:\\Users\\test\\Downloads\\report.pdf",
    state: "complete",
    endTime: "2026-09-11T10:00:05.000Z",
    ...overrides
  };
}

test("a file name is compared on its base name, whatever path the browser reports", () => {
  assert.equal(downloadFilenameMatches("C:\\Users\\test\\Downloads\\report.pdf", "report.pdf"), true);
  assert.equal(downloadFilenameMatches("/home/test/Downloads/report.pdf", "report.pdf"), true);
  assert.equal(downloadFilenameMatches("/home/test/Downloads/report.pdf", "/elsewhere/report.pdf"), true);
  assert.equal(downloadFilenameMatches("/home/test/Downloads/REPORT.PDF", "report.pdf"), true);
  assert.equal(downloadFilenameMatches("/home/test/Downloads/invoice.csv", "report.pdf"), false);
});

test("the name the browser uses when the file already exists still counts", () => {
  assert.equal(downloadFilenameMatches("/downloads/report (1).pdf", "report.pdf"), true);
  assert.equal(downloadFilenameMatches("/downloads/report (12).pdf", "report.pdf"), true);
  assert.equal(downloadFilenameMatches("/downloads/report (1)", "report"), true);
  assert.equal(downloadFilenameMatches("/downloads/other (1).pdf", "report.pdf"), false);
});

test("a wait that named no file is satisfied by any download", () => {
  assert.equal(downloadFilenameMatches("/downloads/anything.zip", undefined), true);
});

test("only a completed, still-present download that finished in the window is selected", () => {
  assert.deepEqual(selectCompletedDownload([download()], "report.pdf", since)?.state, "complete");
  assert.equal(selectCompletedDownload([download({ state: "in_progress" })], "report.pdf", since), undefined);
  assert.equal(selectCompletedDownload([download({ state: "interrupted" })], "report.pdf", since), undefined);
  assert.equal(selectCompletedDownload([download({ exists: false })], "report.pdf", since), undefined);
  assert.equal(selectCompletedDownload([download()], "invoice.csv", since), undefined);
  assert.equal(selectCompletedDownload([], "report.pdf", since), undefined);
});

test("a file left behind by an earlier run cannot pass for this one", () => {
  const stale = download({ endTime: "2026-09-11T09:30:00.000Z" });
  assert.equal(selectCompletedDownload([stale], "report.pdf", since), undefined);
});

test("the most recently finished match wins", () => {
  const older = download({ filename: "/downloads/report.pdf", endTime: "2026-09-11T10:00:01.000Z" });
  const newer = download({ filename: "/downloads/report (1).pdf", endTime: "2026-09-11T10:00:09.000Z" });
  assert.equal(selectCompletedDownload([older, newer], "report.pdf", since)?.filename, "/downloads/report (1).pdf");
  assert.equal(selectCompletedDownload([newer, older], "report.pdf", since)?.filename, "/downloads/report (1).pdf");
});

test("a download with no end time is accepted rather than discarded on a missing field", () => {
  const item: CompletedDownload = { filename: "/downloads/report.pdf", state: "complete" };
  assert.deepEqual(selectCompletedDownload([item], "report.pdf", since), item);
});

test("the input list is not reordered", () => {
  const older = download({ filename: "/downloads/a.pdf", endTime: "2026-09-11T10:00:01.000Z" });
  const newer = download({ filename: "/downloads/b.pdf", endTime: "2026-09-11T10:00:09.000Z" });
  const items = [older, newer];
  selectCompletedDownload(items, undefined, since);
  assert.deepEqual(items, [older, newer]);
});

/** The shortest wait the module allows: `clampTimeout` floors a request at one second. */
const MIN_TIMEOUT_MS = 1_000;

const waitAction: BrowserActionCommand = {
  commandId: "d-1",
  actionType: "web.browser.download",
  download: { filename: "report.pdf", timeoutMs: MIN_TIMEOUT_MS }
};

/** Installs a `chrome` with or without `downloads`, and puts the global back however it ends. */
async function runDownloadAction(downloads: unknown): Promise<Awaited<ReturnType<typeof runBrowserDownloadAction>>> {
  (globalThis as { chrome?: unknown }).chrome = downloads === undefined ? {} : { downloads };
  try {
    return await runBrowserDownloadAction(waitAction);
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

test("a build without the downloads permission refuses the wait, nameably", async () => {
  const result = await runDownloadAction(undefined);
  assert.equal(result.status, "failed");
  // `web.download.permission_missing` before, which was in no set. The set has
  // one code for a refusal; which refusal is what `actual` carries.
  assert.deepEqual(result.failure, {
    category: "blocked_by_capability_or_policy",
    code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED,
    retryable: false,
    stage: "execution",
    expected: "a completed download named report.pdf",
    actual: "the downloads permission is not granted"
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a wait that finds nothing times out, and the timeout is the set's own", async () => {
  const result = await runDownloadAction({
    search: () => Promise.resolve([]),
    onChanged: { addListener: () => undefined, removeListener: () => undefined }
  });
  // The status is unchanged: this is a vocabulary change, not a behaviour one.
  assert.equal(result.status, "timed_out");
  assert.deepEqual(result.failure, {
    category: "timeout",
    // `web.download.timeout` before. The record is otherwise identical -- the
    // set binds `timeout` to the same category, stage and retryability the call
    // site used to write out.
    code: WEB_AUTOMATION_FAILURE_CODES.TIMEOUT,
    retryable: true,
    stage: "execution",
    expected: "a completed download named report.pdf",
    actual: `no matching download completed within ${MIN_TIMEOUT_MS} ms`
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});
