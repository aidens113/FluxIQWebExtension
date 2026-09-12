// T1 coverage of the pure parts of browser-download.ts: which download satisfies
// a wait. Waiting itself needs chrome.downloads, which this Node runner does not
// provide. The rules that matter are that a file left by an earlier run cannot
// pass for this one, and that a file the browser renamed still counts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadFilenameMatches, selectCompletedDownload, type CompletedDownload } from "../browser-download";

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
