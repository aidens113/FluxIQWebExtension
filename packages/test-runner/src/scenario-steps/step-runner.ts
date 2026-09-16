import type { BrowserContext, Page } from "@playwright/test";
import type { RunStepTiming, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { selectOptionByKeyboard, uploadDeterministicFile } from "../trusted-input/index.js";
import type { ExtractionStepRead } from "../run-expectations/index.js";
import { DownloadWatch } from "./download-watch.js";
import type { ExtractionIntentDriver } from "./extract-intent.js";
import { extractRecords } from "./extract-records.js";
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
  /** Scripted navigation bound to the extension control page after recording starts. */
  scriptedNavigation(page: Page, url: string, timeoutMs?: number): Promise<void>;
  /**
   * FluxIQ's own extraction, bound to the extension control page
   * (`extract-intent.ts`). When it is present every `extract` step goes through
   * it and the runner never reads the page itself, because a run judged on what
   * the harness read measures the harness. It is absent only for a run whose
   * extension holds no automation tab to read from -- one that never paired --
   * where `extract-records.ts` is the reference reader.
   */
  extractionIntent?: ExtractionIntentDriver;
  /** Test seam for the post-wheel recorder settlement delay. */
  settleScroll?: (delayMs: number) => Promise<void>;
  now?: () => number;
};

export type ScenarioStepResult = {
  /**
   * What an `extract` step read, and nothing for any other operation.
   *
   * The records and the read's account of itself travel together because a
   * measurement needs both (`runExtractionMeasurements`): records with no
   * account of the read behind them would be a measurement whose pages,
   * truncation and duration are silently absent rather than reported as
   * unreported. Which members that account carries depends on who read: the
   * intent seam reports pages, truncation and a duration, and the reference
   * reader reports none of them.
   */
  extraction?: ExtractionStepRead;
};

const DEFAULT_WAIT_MS = 15_000;
// The content recorder emits a scroll only after 400 ms without another scroll
// event. Keep scripted wheel steps distinct by allowing that debounce plus a
// scheduling margin to settle before the next scenario step can begin.
const SCROLL_RECORDER_SETTLEMENT_MS = 500;

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
      const result = await this.perform(step, startedAt);
      const completedAt = this.now();
      this.record(step, startedAt, "succeeded", completedAt);
      return result;
    } catch (error) {
      this.record(step, startedAt, "failed");
      throw error;
    }
  }

  dispose(): void {
    this.downloads.dispose();
  }

  private record(step: ScenarioStep, startedAt: number, outcome: RunStepTiming["outcome"], completedAt = this.now()): void {
    this.recorded.push({ stepId: step.id, operation: step.operation, startedAt: new Date(startedAt).toISOString(), durationMs: Math.max(0, Math.round(completedAt - startedAt)), outcome });
  }

  private async perform(step: ScenarioStep, startedAt: number): Promise<ScenarioStepResult> {
    const page = this.tabs.active();
    const timeout = step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs };
    const timeoutMs = step.timeoutMs === undefined ? {} : { timeoutMs: step.timeoutMs };
    const target = () => locateTarget(page, parseScenarioTarget(step.target));
    switch (step.operation) {
      case "click": await target().click(timeout); return {};
      case "type": await target().fill(String(step.value ?? ""), timeout); return {};
      case "select": await selectOptionByKeyboard(target(), String(step.value ?? ""), timeoutMs); return {};
      case "scroll": {
        await page.mouse.wheel(0, Number(step.value ?? 500));
        await (this.options.settleScroll ?? wait)(SCROLL_RECORDER_SETTLEMENT_MS);
        return {};
      }
      case "navigate": {
        await this.options.scriptedNavigation(page, `${this.options.origin}${step.path ?? "/"}`, step.timeoutMs);
        return {};
      }
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
      case "extract": {
        const intent = this.options.extractionIntent;
        if (intent === undefined) {
          // The reference reader keeps a field only as text or as `null`
          // (`extract-records.ts`), so it carried no value that was not a
          // string -- a fact about that reader, not a default. It reports no
          // pages, no truncation flag and no duration, and says so by leaving
          // them out: an expectation naming one is then refused as unjudgeable
          // rather than passed on the half of it this reader could check.
          return { extraction: { records: await extractRecords(page, step), observed: { nonStringValues: 0 } } };
        }
        const { records, ...observed } = await intent(page, step);
        return { extraction: { records, observed } };
      }
      default: {
        const unsupported: never = step.operation;
        throw new RunnerFailure("fixture.invalid", `Unsupported scenario step operation: ${String(unsupported)}`);
      }
    }
  }

}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function requiredText(step: ScenarioStep, value: unknown): string {
  if (typeof value !== "string" || !value) throw new RunnerFailure("fixture.invalid", `Step ${step.id} (${step.operation}) needs a non-empty string`);
  return value;
}
