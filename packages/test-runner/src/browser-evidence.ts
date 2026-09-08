import { randomBytes } from "node:crypto";
import path from "node:path";
import type { Page } from "@playwright/test";
import { EvidenceBundle, EvidenceCaptureController, createCorrelationId } from "@fluxiq-web-extension/test-evidence";

export type BrowserEvidenceSurface = "panel" | "extension" | "scenario";
export type BrowserEvidenceDiagnosticFact = boolean | number;

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
    redactionSecrets?: readonly string[];
  }) {
    const sampleFps = input.sampleFps ?? 0;
    this.runId = `${input.scenarioId}-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomBytes(3).toString("hex")}`;
    this.pages = input.pages;
    this.scenarioId = input.scenarioId;
    this.bundle = new EvidenceBundle({
      rootDirectory: path.join(input.workspaceDirectory, "evidence"),
      runId: this.runId,
      scenarioId: input.scenarioId,
      redaction: { secrets: [...(input.redactionSecrets ?? [])] },
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

  async step<T>(surface: BrowserEvidenceSurface, stepId: string, summary: string, action: () => Promise<T>, options: { sensitive?: boolean } = {}): Promise<T> {
    const screenshotSuppression = options.sensitive ? "sensitive-action" as const : undefined;
    await this.queueCapture("step.start", `Before: ${summary}`, stepId, surface, screenshotSuppression);
    try {
      const result = await action();
      await this.queueCapture("step.complete", `After: ${summary}`, stepId, surface, screenshotSuppression);
      return result;
    } catch (error) {
      await this.queueCapture("error", `Failed: ${summary}`, stepId, surface, screenshotSuppression).catch(() => undefined);
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

  async diagnostic(surface: BrowserEvidenceSurface, stage: string, errorCode: string, facts: Readonly<Record<string, BrowserEvidenceDiagnosticFact>>): Promise<void> {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(stage) || !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(errorCode)) {
      throw new Error("Evidence diagnostic identity is invalid");
    }
    const entries = Object.entries(facts);
    if (entries.length > 12 || entries.some(([key, value]) => !/^[a-z][a-zA-Z0-9]{0,47}$/u.test(key)
      || (typeof value !== "boolean" && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000)))) {
      throw new Error("Evidence diagnostic facts are invalid");
    }
    await this.queueCapture("checkpoint", "Sanitized diagnostic checkpoint", `diagnostic-${stage}`, surface, "sensitive-action", {
      diagnostic: { stage, errorCode, facts: Object.fromEntries(entries) },
    });
  }
  async finalize(verdict: "passed" | "failed"): Promise<string> {
    await this.pending;
    const result = await this.bundle.finalize({ verdict });
    return result.path;
  }

  private queueCapture(trigger: "step.start" | "step.complete" | "checkpoint" | "error" | "final", summary: string, stepId: string, surface: BrowserEvidenceSurface, screenshotSuppression?: "sensitive-action", safeDetails: Readonly<Record<string, unknown>> = {}): Promise<void> {
    const operation = this.pending.then(async () => {
      await this.capture.trigger({
        trigger,
        summary,
        correlation: { runId: this.runId, scenarioId: this.scenarioId, stepId, correlationId: createCorrelationId() },
        details: { surface, ...safeDetails },
        ...(screenshotSuppression ? { screenshotSuppression } : {}),
      });
    });
    this.pending = operation.catch(() => undefined);
    return operation.then(() => undefined);
  }
}
