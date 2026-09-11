import { setTimeout as delay } from "node:timers/promises";
import type { BrowserContext, Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

/**
 * The tab the script acts on. `switchTo` moves to the open scenario tab whose
 * URL path matches exactly, waiting for a tab still opening; `closeActive`
 * closes it and returns to the tab active before it. The first scenario tab is
 * never closed.
 */
export class ScenarioTabs {
  private stack: Page[];

  constructor(private readonly context: BrowserContext, initial: Page, private readonly isScenarioUrl: (url: string) => boolean, private readonly now: () => number = Date.now) {
    this.stack = [initial];
  }

  active(): Page {
    return this.stack[this.stack.length - 1]!;
  }

  async switchTo(pathname: string, timeoutMs: number): Promise<Page> {
    const deadline = this.now() + timeoutMs;
    for (;;) {
      const page = [...this.context.pages()].reverse().find((candidate) => !candidate.isClosed() && this.hasPath(candidate.url(), pathname));
      if (page) {
        await page.waitForLoadState("domcontentloaded", { timeout: Math.max(1, deadline - this.now()) });
        await page.bringToFront();
        if (this.active() !== page) this.stack.push(page);
        return page;
      }
      if (this.now() >= deadline) {
        const open = this.context.pages().filter((candidate) => !candidate.isClosed() && this.isScenarioUrl(candidate.url())).map((candidate) => new URL(candidate.url()).pathname);
        throw new RunnerFailure("runtime.behavior", "No open scenario tab has the requested path", { details: { pathname, open } });
      }
      await delay(100);
    }
  }

  async closeActive(): Promise<Page> {
    const closing = this.active();
    if (this.stack.length < 2 || closing === this.stack[0]) throw new RunnerFailure("fixture.invalid", "closeTab closes a tab reached by switchTab, never the scenario's first tab");
    this.stack = this.stack.filter((page) => page !== closing);
    await closing.close();
    const next = this.active();
    await next.bringToFront();
    return next;
  }

  private hasPath(url: string, pathname: string): boolean {
    if (!this.isScenarioUrl(url)) return false;
    try { return new URL(url).pathname === pathname; } catch { return false; }
  }
}
