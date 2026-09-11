import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { BrowserContext, Download } from "@playwright/test";
import { DownloadWatch } from "../download-watch.js";

function fakeDownload(name: string, failure: string | null = null): Download {
  return { suggestedFilename: () => name, failure: async () => failure } as unknown as Download;
}

function fakeContext() {
  const context = new EventEmitter();
  const pages = [new EventEmitter()];
  Object.assign(context, { pages: () => pages });
  return { context: context as unknown as BrowserContext & EventEmitter, first: pages[0]! };
}

test("finds a completed download a preceding click already started, from any page, once per wait", async () => {
  const { context, first } = fakeContext();
  const watch = new DownloadWatch(context);
  first.emit("download", fakeDownload("report-101.csv"));
  const later = new EventEmitter();
  context.emit("page", later);
  later.emit("download", fakeDownload("report-101.csv"));
  await watch.waitFor("report-101.csv", 1_000);
  await watch.waitFor("report-101.csv", 1_000);
  await assert.rejects(watch.waitFor("report-101.csv", 0), /No download/);
  watch.dispose();
});

test("waits for a download that starts after the wait began", async () => {
  const { context, first } = fakeContext();
  const watch = new DownloadWatch(context);
  setTimeout(() => first.emit("download", fakeDownload("late.csv")), 20);
  await watch.waitFor("late.csv", 2_000);
});

test("a failed download or a different file name fails the wait", async () => {
  const { context, first } = fakeContext();
  const watch = new DownloadWatch(context);
  first.emit("download", fakeDownload("broken.csv", "canceled"));
  first.emit("download", fakeDownload("other.csv"));
  await assert.rejects(watch.waitFor("broken.csv", 1_000), /Download failed/);
  await assert.rejects(watch.waitFor("wanted.csv", 0), (error: unknown) => /No download/.test(String(error)) && JSON.stringify((error as { details?: unknown }).details).includes("other.csv"));
});
