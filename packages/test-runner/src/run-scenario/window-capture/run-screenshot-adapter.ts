import type { BrowserContext } from "@playwright/test";
import type { CaptureEvidenceEventInput, ScreenshotAdapter, VerifiedVisual } from "@fluxiq-web-extension/test-evidence";
import { captureFirstAvailable, type CaptureSource } from "./capture-first-available.js";
import { ensureWindowCaptureHelper } from "./ensure-window-capture-helper.js";
import { frontTabSource } from "./front-tab-source.js";
import { nativeWindowSource, type SettledHelper } from "./native-window-source.js";

/** What the run has launched by the time a picture is asked for; `undefined` before the browser exists. */
export type RunCaptureSession = { context: BrowserContext; profileDir: string; scenarioOrigin: string };

export type RunScreenshotAdapterInput = {
  session: () => RunCaptureSession | undefined;
  log?: (line: string) => void;
  platform?: NodeJS.Platform;
  /** The sources to try, in order; a test injects its own. */
  sources?: (session: RunCaptureSession) => CaptureSource[];
};

/** The whole budget of one capture, every fallback included. */
const CAPTURE_DEADLINE_MS = 4_000;
const JPEG_QUALITY = 70;
/** A run whose capture keeps failing in new words logs only this many of them. */
const MAX_LOGGED_REASONS = 20;
/**
 * Pictures are taken at the run's moments, not at every scripted step: a step
 * pair photographed twice per step would add seconds to a recording whose
 * timing a site's own timers can race. Those events keep publishing
 * `capture-unavailable`, as they did before this adapter existed.
 */
const SKIPPED_TRIGGERS = new Set<CaptureEvidenceEventInput["trigger"]>(["step.start", "step.complete"]);

/**
 * The run's `ScreenshotAdapter`: a picture of what the person watching the Lab
 * sees, taken without moving focus and never allowed to fail or hold up the run.
 *
 * On Windows it photographs the run's own Chromium window natively, found by
 * the run's profile directory (`nativeWindowSource`); where that is
 * unavailable, or on any other platform, a Playwright screenshot of the
 * scenario tab in front (`frontTabSource`). The helper compiles as the adapter
 * is created, long before the browser exists, so the first capture does not
 * pay for it. Each capture is bounded to 4 s in all; one that produces nothing
 * answers `undefined`, which the evidence controller publishes as
 * `capture-unavailable`, and the reason each source failed is logged once per
 * distinct reason so a run with no pictures says why.
 */
export function createRunScreenshotAdapter(input: RunScreenshotAdapterInput): ScreenshotAdapter {
  const platform = input.platform ?? process.platform;
  const helper: Promise<SettledHelper> | undefined = platform === "win32" && !input.sources
    ? ensureWindowCaptureHelper().then(path => ({ path }), (error: unknown) => ({ error }))
    : undefined;
  const sources = input.sources ?? ((session: RunCaptureSession) => [
    ...(helper ? [nativeWindowSource({ helper, profileDir: session.profileDir, quality: JPEG_QUALITY })] : []),
    frontTabSource(session.context, session.scenarioOrigin, JPEG_QUALITY),
  ]);
  let nativeSource: { profileDir: string; list: CaptureSource[] } | undefined;
  const logged = new Set<string>();
  // Cleanup publishes events after the browser has closed; a picture of a closed browser is not attempted at all.
  const closed = new WeakSet<BrowserContext>();
  const watched = new WeakSet<BrowserContext>();
  return {
    capture: async (event): Promise<VerifiedVisual | undefined> => {
      if (SKIPPED_TRIGGERS.has(event.trigger)) return undefined;
      const session = input.session();
      if (!session || closed.has(session.context)) return undefined;
      if (!watched.has(session.context) && typeof session.context.once === "function") {
        watched.add(session.context);
        session.context.once("close", () => { closed.add(session.context); });
      }
      // One source list per profile directory, so the native source keeps the browser process it found.
      if (!nativeSource || nativeSource.profileDir !== session.profileDir) nativeSource = { profileDir: session.profileDir, list: sources(session) };
      const attempt = await captureFirstAvailable(nativeSource.list, CAPTURE_DEADLINE_MS);
      for (const failure of attempt.failures) {
        const line = `[lab screenshots] ${failure.source}: ${failure.reason}`;
        if (!logged.has(line) && logged.size < MAX_LOGGED_REASONS) { logged.add(line); input.log?.(line); }
      }
      return attempt.bytes ? { bytes: attempt.bytes, mediaType: "image/jpeg", redactionVerified: true } : undefined;
    },
  };
}
