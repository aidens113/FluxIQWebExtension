import type { BrowserContext, Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

export type ConsoleErrorEntry = { source: "console" | "pageerror"; text: string };

const REPORTED_ERRORS = 5;
const REPORTED_LENGTH = 300;

/**
 * Collects console errors and uncaught page errors from scenario tabs (their
 * frames included), so a run fails on any error its manifest does not allow.
 * Extension pages and the FluxIQ panel are not scenario tabs.
 */
export class ConsoleErrorWatch {
  private readonly entries: ConsoleErrorEntry[] = [];
  private readonly watched = new WeakSet<Page>();
  private readonly onPage = (page: Page): void => this.watch(page);

  constructor(private readonly context: BrowserContext, private readonly isScenarioUrl: (url: string) => boolean) {
    for (const page of context.pages()) this.watch(page);
    context.on("page", this.onPage);
  }

  errors(): ConsoleErrorEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  /** Fails on any collected error whose text contains none of the allowed strings. */
  assertOnlyAllowed(allowed: readonly string[] = []): void {
    const unexpected = this.entries.filter((entry) => !allowed.some((pattern) => entry.text.includes(pattern)));
    if (!unexpected.length) return;
    throw new RunnerFailure("runtime.behavior", `Scenario page reported ${unexpected.length} console error(s) its manifest does not allow`, {
      details: { count: unexpected.length, errors: unexpected.slice(0, REPORTED_ERRORS).map((entry) => ({ source: entry.source, text: entry.text.slice(0, REPORTED_LENGTH) })) },
    });
  }

  dispose(): void {
    this.context.off("page", this.onPage);
  }

  private watch(page: Page): void {
    if (this.watched.has(page)) return;
    this.watched.add(page);
    page.on("console", (message) => {
      if (message.type() === "error" && this.isScenarioUrl(page.url())) this.entries.push({ source: "console", text: message.text() });
    });
    page.on("pageerror", (error) => {
      if (this.isScenarioUrl(page.url())) this.entries.push({ source: "pageerror", text: error.message });
    });
  }
}
