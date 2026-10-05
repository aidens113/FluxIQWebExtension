import { writeFile } from "node:fs/promises";
import { assertNoSensitiveText } from "@fluxiq-web-extension/test-evidence";
import { uiReviewPaths } from "./review-paths.js";
import type { UiReviewMoment } from "./types.js";

export type UiReviewSidecar = {
  runsDirectory: string;
  runId: string;
  secrets: readonly string[];
  startedAt: string;
  attached: boolean;
  moments: readonly UiReviewMoment[];
  /** Phases reported before the browser was attached, which took no moment. */
  skipped: readonly { phase: string; atMs: number }[];
  skippedTicks: number;
  failures: readonly string[];
};

const NOTE = "Local UI review of one Lab run: screenshots of the scenario tab and the extension panel at start, during a build, as a Flow run was started and while it ran, at the end and at a failure, and at each the on-page activity overlay sampled about every 200 ms for about 3 s. Not part of the evidence bundle: written beside it in the runs directory, never indexed or hashed. Every string was screened for the run's secrets, token patterns, pairing codes and URLs beyond origin and path; a picture was withheld whenever a secret or the pairing code was shown and could not be masked. Never commit it; test-runs/ is git-ignored.";

/**
 * Writes the review's JSON and returns where it went. The finished file is
 * asserted clean with the run's secrets; one that is not is replaced by a stub
 * that says so, and the moments' pictures are listed nowhere.
 */
export async function writeUiReviewSidecar(input: UiReviewSidecar): Promise<string> {
  const paths = uiReviewPaths(input.runsDirectory, input.runId);
  const base = { schemaVersion: "0.1", tier: "local", published: false, note: NOTE, runId: input.runId, startedAt: input.startedAt, directory: paths.directoryName };
  const overlay = input.moments.map(moment => ({ index: moment.index, label: moment.label, status: moment.overlay.counts.status, textChanges: moment.overlay.counts.textChanges, presenceToggles: moment.overlay.counts.presenceToggles, visibilityToggles: moment.overlay.counts.visibilityToggles, pageLoads: moment.overlay.counts.pageLoads, pageLoadGaps: moment.overlay.counts.pageLoadGaps, probablePageLoads: moment.overlay.counts.probablePageLoads, openTabs: moment.scenario.openTabs?.length ?? null, presentSamples: moment.overlay.counts.presentSamples, visibleSamples: moment.overlay.counts.visibleSamples, samples: moment.overlay.counts.samples }));
  const summary = { moments: input.moments.length, scenarioPictures: input.moments.filter(moment => moment.scenario.file).length, panelPictures: input.moments.filter(moment => moment.panel.file).length, panelSources: [...new Set(input.moments.map(moment => moment.panel.source))], overlay };
  let body = `${JSON.stringify({ ...base, attached: input.attached, summary, skipped: input.skipped, skippedTicks: input.skippedTicks, failures: input.failures, moments: input.moments }, null, 2)}\n`;
  try {
    assertNoSensitiveText(body, input.secrets.filter(secret => secret.length > 0));
  } catch {
    body = `${JSON.stringify({ ...base, withheld: "redaction_failed", moments: [] }, null, 2)}\n`;
  }
  await writeFile(paths.json, body, "utf8");
  return paths.json;
}
