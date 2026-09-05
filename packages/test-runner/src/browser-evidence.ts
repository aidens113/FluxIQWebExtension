import { randomBytes } from "node:crypto";
import path from "node:path";
import type { Page } from "@playwright/test";
import { EvidenceBundle, EvidenceCaptureController, createCorrelationId } from "@fluxiq-web-extension/test-evidence";

export type BrowserEvidenceSurface = "panel" | "extension" | "scenario";

export class BrowserEvidenceRecorder {
  readonly runId: string;
  private readonly bundle: EvidenceBundle;
  private readonly capture: EvidenceCaptureController;
  private readonly pages: Record<BrowserEvidenceSurface, Page>;
  private readonly scenarioId: string;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(input: {
    workspaceDirectory: string;
    scenarioId: string;
    pages: Record<BrowserEvidenceSurface, Page>;
    sampleFps?: number;
  }) {
    const sampleFps = input.sampleFps ?? 0;
    this.runId = `${input.scenarioId}-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomBytes(3).toString("hex")}`;
    this.pages = input.pages;
    this.scenarioId = input.scenarioId;
    this.bundle = new EvidenceBundle({
      rootDirectory: path.join(input.workspaceDirectory, "evidence"),
      runId: this.runId,
      scenarioId: input.scenarioId,
      redaction: { secrets: [] },
    });
    this.capture = new EvidenceCaptureController(this.bundle, {
      screenshots: "events",
      trace: "off",
      video: "off",
      sampleFps,
      maxScreenshots: 10_000,
      maxBytes: 512 * 1024 * 1024,
      reviewRequired: true,
      minimumScreenshotIntervalMs: 0,
      deduplicateScreenshots: false,
    }, {
      capture: async event => {
        const requested = event.details?.surface;
        const surface: BrowserEvidenceSurface = requested === "panel" || requested === "extension" ? requested : "scenario";
        const page = this.pages[surface];
        if (page.isClosed()) return undefined;
        await page.bringToFront();
        const bytes = await page.locator("body").screenshot({ type: "jpeg", quality: 65, timeout: 10_000 });
        if (surface === "extension" && !this.pages.scenario.isClosed()) await this.pages.scenario.bringToFront();
        return { bytes, mediaType: "image/jpeg", redactionVerified: true };
      },
    });
  }

  async start(): Promise<void> {
    await this.bundle.initialize();
  }

  async step<T>(surface: BrowserEvidenceSurface, stepId: string, summary: string, action: () => Promise<T>): Promise<T> {
    await this.queueCapture("step.start", `Before: ${summary}`, stepId, surface);
    try {
      const result = await action();
      await this.queueCapture("step.complete", `After: ${summary}`, stepId, surface);
      return result;
    } catch (error) {
      await this.queueCapture("error", `Failed: ${summary}`, stepId, surface).catch(() => undefined);
      throw error;
    }
  }

  async runtimeActionBoundary(input: {
    phase: "before" | "after";
    commandId: string;
    actionType: string;
    status?: string;
  }): Promise<void> {
    const stepId = `runtime-action-${input.commandId}`;
    const status = input.phase === "after" && input.status ? ` (${input.status})` : "";
    await this.queueCapture(
      input.phase === "before" ? "step.start" : "step.complete",
      `${input.phase === "before" ? "Before" : "After"}: Flow action ${input.actionType}${status}`,
      stepId,
      "scenario",
    );
  }

  async finalize(verdict: "passed" | "failed"): Promise<string> {
    await this.pending;
    const result = await this.bundle.finalize({ verdict });
    return result.path;
  }

  private queueCapture(trigger: "step.start" | "step.complete" | "checkpoint" | "error" | "final", summary: string, stepId: string, surface: BrowserEvidenceSurface): Promise<void> {
    const operation = this.pending.then(async () => {
      await this.capture.trigger({
        trigger,
        summary,
        correlation: { runId: this.runId, scenarioId: this.scenarioId, stepId, correlationId: createCorrelationId() },
        details: { surface },
      });
    });
    this.pending = operation.catch(() => undefined);
    return operation.then(() => undefined);
  }
}
