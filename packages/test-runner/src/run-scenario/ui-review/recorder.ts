// A run's UI review: what the person watching a headed Lab run actually saw.
//
// The user's rule (2026-09-29): every live run's debug reviews the UI. The
// user reported that the on-page activity overlay was not visible, or only in
// some state, that its status flickered constantly, and that the chat looked
// wrong, and none of that could be read from a bundle that takes no
// screenshots (`run-scenario.ts`, `screenshotAdapter`). So at each phase of
// the run, and every ~20 s while a build or a Flow run is in progress, this
// photographs the scenario tab and the extension panel and samples the
// overlay for a few seconds (`sample-overlay-window.ts`).
//
// It measures the UI and changes none of it. It never fails the run: every
// capture that cannot be made is recorded with why, and every method here
// resolves. Its files are local only, beside the bundle (`review-paths.ts`).

import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { screenText } from "../extension-start-trace/index.js";
import { captureExtensionPanel } from "./capture-extension-panel.js";
import { captureScenarioTab } from "./capture-scenario-tab.js";
import { chooseScenarioTab } from "./choose-scenario-tab.js";
import { countOverlayChanges } from "./count-overlay-changes.js";
import { sampleOverlayWindow } from "./sample-overlay-window.js";
import { screenLocation } from "./screen-location.js";
import type { OverlaySampleWindow, UiReviewLabel, UiReviewMoment, UiReviewPhase } from "./types.js";
import { uiReviewPaths } from "./review-paths.js";
import { UiReviewSchedule } from "./schedule.js";
import { writeUiReviewSidecar } from "./write-ui-review-sidecar.js";

export type UiReviewRecorderOptions = {
  runsDirectory: string;
  runId: string;
  secrets: readonly string[];
  periodMs?: number;
  captureTimeoutMs?: number;
  log?: (line: string) => void;
};
export type UiReviewSession = { context: BrowserContext; scenarioPage: Page; controlPage: Page };

const CAPTURE_TIMEOUT_MS = 4_000;

export class UiReviewRecorder {
  private readonly options: UiReviewRecorderOptions;
  private readonly startedAt = Date.now();
  private readonly schedule: UiReviewSchedule;
  private readonly moments: UiReviewMoment[] = [];
  private readonly skipped: { phase: string; atMs: number }[] = [];
  private readonly log: (line: string) => void;
  private session: UiReviewSession | undefined;
  private written: Promise<void> | undefined;

  constructor(options: UiReviewRecorderOptions) {
    this.options = options;
    this.log = options.log ?? (line => process.stderr.write(`${line}\n`));
    this.schedule = new UiReviewSchedule({ take: (label, phase) => this.take(label, phase), ...(options.periodMs === undefined ? {} : { periodMs: options.periodMs }) });
  }

  /** The browser the moments are taken in; phases before this take none. */
  attach(session: UiReviewSession): void { this.session = session; }

  /** Enters a phase in progress and takes its moment in the background; the run does not wait for it. */
  phase(phase: Exclude<UiReviewPhase, "end" | "failure">): void { void this.schedule.enter(phase); }

  /** The terminal moment, awaited so it is taken while the browser is still open. Only the first of `end` and `failure` counts. */
  finish(phase: "end" | "failure"): Promise<void> { return this.schedule.enter(phase); }

  /** Takes nothing more, waits for the moment in flight, and writes the review's JSON. Resolves whatever happens; runs once. */
  close(): Promise<void> {
    this.written ??= this.writeReview();
    return this.written;
  }

  private async writeReview(): Promise<void> {
    this.schedule.stop();
    await this.schedule.idle();
    try {
      const written = await writeUiReviewSidecar({ runsDirectory: this.options.runsDirectory, runId: this.options.runId, secrets: this.options.secrets, startedAt: new Date(this.startedAt).toISOString(), attached: this.session !== undefined, moments: this.moments, skipped: this.skipped, skippedTicks: this.schedule.skippedTicks, failures: this.schedule.failures });
      this.log(`[lab] ui review: ${this.moments.length} moment(s) in ${written}`);
    } catch (error) {
      this.log(`[lab] ui review: the review could not be written: ${screenText(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error), this.options.secrets)}`);
    }
  }

  private async take(label: UiReviewLabel, phase: UiReviewPhase): Promise<void> {
    const atMs = Date.now() - this.startedAt;
    const session = this.session;
    if (!session) { this.skipped.push({ phase, atMs }); return; }
    const index = this.moments.length + 1;
    const paths = uiReviewPaths(this.options.runsDirectory, this.options.runId);
    await mkdir(paths.directory, { recursive: true });
    const name = (what: string) => `${String(index).padStart(2, "0")}-${label}-${what}.png`;
    const timeoutMs = this.options.captureTimeoutMs ?? CAPTURE_TIMEOUT_MS;
    const secrets = this.options.secrets;
    const chosen = await chooseScenarioTab(session.context, session.scenarioPage, session.controlPage);
    const [pictures, overlay] = await Promise.all([
      (async () => ({
        scenario: await captureScenarioTab({ page: chosen.page, ...(chosen.documentVisibility === undefined ? {} : { documentVisibility: chosen.documentVisibility }), inFront: chosen.inFront, frontTabs: chosen.frontTabs, path: path.join(paths.directory, name("scenario")), file: `${paths.directoryName}/${name("scenario")}`, secrets, timeoutMs }),
        panel: await captureExtensionPanel({ context: session.context, controlPage: session.controlPage, path: path.join(paths.directory, name("panel")), file: `${paths.directoryName}/${name("panel")}`, secrets, timeoutMs }),
      }))(),
      this.sampleOverlay(session.context, chosen.page),
    ]);
    const moment: UiReviewMoment = { index, label, phase, at: new Date().toISOString(), atMs, scenario: pictures.scenario, panel: pictures.panel, overlay };
    this.moments.push(moment);
    const counts = overlay.counts;
    this.log(`[lab] ui review #${index} ${label}: scenario ${pictures.scenario.file ?? pictures.scenario.withheld ?? pictures.scenario.error}; panel (${pictures.panel.source}) ${pictures.panel.file ?? pictures.panel.withheld ?? pictures.panel.error}; overlay ${counts.status}, ${counts.visibleSamples}/${counts.samples} visible, ${counts.textChanges} text change(s), ${counts.presenceToggles} presence toggle(s)`);
  }

  private async sampleOverlay(context: BrowserContext, page: Page): Promise<OverlaySampleWindow> {
    const pageUrl = screenLocation(page.url(), this.options.secrets);
    try {
      const cdp = await context.newCDPSession(page);
      try { return await sampleOverlayWindow({ cdp, secrets: this.options.secrets, pageUrl }); }
      finally { await cdp.detach().catch(/* best-effort: a session on a tab that has closed is already gone */ () => undefined); }
    } catch (error) {
      return { startedAt: new Date().toISOString(), intervalMs: 0, durationMs: 0, pageUrl, samples: [], counts: countOverlayChanges([]), error: screenText(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error), this.options.secrets) };
    }
  }
}
