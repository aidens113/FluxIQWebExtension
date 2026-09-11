import type { BrowserContext, Page } from "@playwright/test";
import type { RunStepTiming, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { selectOptionByKeyboard, uploadDeterministicFile } from "../trusted-input/index.js";
import { DownloadWatch } from "./download-watch.js";
import { extractRecords, type ExtractedRecord } from "./extract-records.js";
import { locateTarget } from "./locate-target.js";
import { parseScenarioTarget } from "./parse-target.js";
import { ScenarioTabs } from "./scenario-tabs.js";

export type ScenarioStepRunnerOptions = {
  context: BrowserContext;
  /** The scenario tab the script starts on. */
  page: Page;
  /** Scenario Lab origin that `navigate` paths are relative to. */
  origin: string;
  /** Whether a URL belongs to the Scenario Lab, for `switchTab`. */
  isScenarioUrl(url: string): boolean;
  /** Run-owned directory for `upload` files. */
  uploadDirectory: string;
  now?: () => number;
};

export type ScenarioStepResult = { extracted?: ExtractedRecord[] };

const DEFAULT_WAIT_MS = 15_000;

/**
 * Performs recording-script steps with Playwright on the active scenario tab,
 * as trusted browser input the extension records, and times each one.
 */
export class ScenarioStepRunner {
  private readonly tabs: ScenarioTabs;
  private readonly downloads: DownloadWatch;
  private readonly recorded: RunStepTiming[] = [];
  private readonly now: () => number;

  constructor(private readonly options: ScenarioStepRunnerOptions) {
    this.now = options.now ?? Date.now;
    this.tabs = new ScenarioTabs(options.context, options.page, options.isScenarioUrl, this.now);
    this.downloads = new DownloadWatch(options.context, this.now);
  }

  activePage(): Page {
    return this.tabs.active();
  }

  /** Every step started so far, in order, including one that failed. */
  timings(): RunStepTiming[] {
    return this.recorded.map((timing) => ({ ...timing }));
  }

  async run(step: ScenarioStep): Promise<ScenarioStepResult> {
    const startedAt = this.now();
    try {
      const result = await this.perform(step);
      this.record(step, startedAt, "succeeded");
      return result;
    } catch (error) {
      this.record(step, startedAt, "failed");
      throw error;
    }
  }

  dispose(): void {
    this.downloads.dispose();
  }

  private record(step: ScenarioStep, startedAt: number, outcome: RunStepTiming["outcome"]): void {
    this.recorded.push({ stepId: step.id, operation: step.operation, startedAt: new Date(startedAt).toISOString(), durationMs: Math.max(0, Math.round(this.now() - startedAt)), outcome });
  }

  private async perform(step: ScenarioStep): Promise<ScenarioStepResult> {
    const page = this.tabs.active();
    const timeout = step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs };
    const timeoutMs = step.timeoutMs === undefined ? {} : { timeoutMs: step.timeoutMs };
    const target = () => locateTarget(page, parseScenarioTarget(step.target));
    switch (step.operation) {
      case "click": await target().click(timeout); return {};
      case "type": await target().fill(String(step.value ?? ""), timeout); return {};
      case "select": await selectOptionByKeyboard(target(), String(step.value ?? ""), timeoutMs); return {};
      case "scroll": await page.mouse.wheel(0, Number(step.value ?? 500)); return {};
      case "navigate": await page.goto(`${this.options.origin}${step.path ?? "/"}`, timeout); return {};
      case "waitForState": await target().waitFor({ state: "visible", ...timeout }); return {};
      case "checkpoint": return {};
      case "press": {
        const key = requiredText(step, step.value);
        if (step.target) await target().press(key, timeout);
        else await page.keyboard.press(key);
        return {};
      }
      case "check":
        if (typeof step.value !== "boolean") throw new RunnerFailure("fixture.invalid", `Check step ${step.id} needs a boolean value`);
        await target().setChecked(step.value, timeout);
        return {};
      case "upload": await uploadDeterministicFile(target(), requiredText(step, step.value), this.options.uploadDirectory, timeoutMs); return {};
      case "switchTab": await this.tabs.switchTo(requiredText(step, step.path), step.timeoutMs ?? DEFAULT_WAIT_MS); return {};
      case "closeTab": await this.tabs.closeActive(); return {};
      case "waitForDownload": await this.downloads.waitFor(requiredText(step, step.value), step.timeoutMs ?? DEFAULT_WAIT_MS); return {};
      case "extract": return { extracted: await extractRecords(page, step) };
      default: {
        const unsupported: never = step.operation;
        throw new RunnerFailure("fixture.invalid", `Unsupported scenario step operation: ${String(unsupported)}`);
      }
    }
  }
}

function requiredText(step: ScenarioStep, value: unknown): string {
  if (typeof value !== "string" || !value) throw new RunnerFailure("fixture.invalid", `Step ${step.id} (${step.operation}) needs a non-empty string`);
  return value;
}
