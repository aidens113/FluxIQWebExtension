import { setTimeout as delay } from "node:timers/promises";
import type { BrowserContext, Download, Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

/**
 * Collects every download started in the context, from any page, so a
 * `waitForDownload` step finds one a preceding click already started. Each
 * download satisfies one wait.
 */
export class DownloadWatch {
  private readonly downloads: Download[] = [];
  private readonly consumed = new Set<Download>();
  private readonly watched = new WeakSet<Page>();
  private readonly onPage = (page: Page): void => this.watch(page);

  constructor(private readonly context: BrowserContext, private readonly now: () => number = Date.now) {
    for (const page of context.pages()) this.watch(page);
    context.on("page", this.onPage);
  }

  /** Resolves once a download with this suggested file name has completed. */
  async waitFor(fileName: string, timeoutMs: number): Promise<void> {
    const deadline = this.now() + timeoutMs;
    for (;;) {
      const download = this.downloads.find((item) => !this.consumed.has(item) && item.suggestedFilename() === fileName);
      if (download) {
        this.consumed.add(download);
        const failure = await withDeadline(download.failure(), Math.max(0, deadline - this.now()));
        if (failure === DEADLINE) throw new RunnerFailure("runtime.behavior", "Download did not complete in time", { details: { fileName } });
        if (failure !== null) throw new RunnerFailure("runtime.behavior", "Download failed", { details: { fileName, failure } });
        return;
      }
      if (this.now() >= deadline) {
        throw new RunnerFailure("runtime.behavior", "No download with the expected file name arrived", { details: { fileName, seen: this.downloads.map((item) => item.suggestedFilename()) } });
      }
      await delay(100);
    }
  }

  dispose(): void {
    this.context.off("page", this.onPage);
  }

  private watch(page: Page): void {
    if (this.watched.has(page)) return;
    this.watched.add(page);
    page.on("download", (download) => { this.downloads.push(download); });
  }
}

const DEADLINE = Symbol("deadline");

async function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T | typeof DEADLINE> {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<typeof DEADLINE>((resolve) => { timer = setTimeout(() => resolve(DEADLINE), milliseconds); });
  try { return await Promise.race([promise, expiry]); }
  finally { clearTimeout(timer); }
}
