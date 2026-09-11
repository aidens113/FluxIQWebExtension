import type { ScenarioEvidencePolicy } from "@fluxiq-web-extension/test-contracts";
import type { CapturePolicy } from "@fluxiq-web-extension/test-evidence";
import type { EvidenceMode } from "../commands.js";

/** What a run captures, and therefore what its bundle publishes as its evidence policy. */
export type EffectiveEvidencePolicy = {
  source: "manifest" | "--evidence";
  /** Whether a failing run keeps a screenshot of the scenario tab. */
  failureScreenshot: boolean;
  capture: CapturePolicy & { trace: "off"; video: "off" };
  /**
   * Manifest capture this runner does not perform. A Playwright trace records
   * cookies, authorization headers, and gateway frames, and video records
   * pixels of sensitive fields, so neither is captured; the published policy
   * says `off` rather than claiming capture that did not happen.
   */
  unsupported: Array<"trace" | "video">;
};

const MAX_SCREENSHOTS = 100;
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The manifest's `evidencePolicy` drives capture unless `--evidence` overrides
 * it. `--evidence failure` keeps only a failure screenshot and `none` keeps
 * nothing; a manifest whose screenshots are `none` also keeps no failure
 * screenshot.
 */
export function effectiveEvidencePolicy(manifest: Partial<ScenarioEvidencePolicy> | undefined, override?: EvidenceMode): EffectiveEvidencePolicy {
  const reviewRequired = manifest?.reviewRequired ?? false;
  if (override !== undefined) {
    const screenshots = override === "events" ? "events" : override === "checkpoints" ? "checkpoints" : "none";
    return { source: "--evidence", failureScreenshot: override !== "none", capture: capture(screenshots, reviewRequired), unsupported: [] };
  }
  const screenshots = manifest?.screenshots ?? "none";
  const unsupported = (["trace", "video"] as const).filter((kind) => (manifest?.[kind] ?? "off") !== "off");
  return { source: "manifest", failureScreenshot: screenshots !== "none", capture: capture(screenshots, reviewRequired), unsupported };
}

function capture(screenshots: ScenarioEvidencePolicy["screenshots"], reviewRequired: boolean): EffectiveEvidencePolicy["capture"] {
  return { screenshots, trace: "off", video: "off", sampleFps: 0, maxScreenshots: MAX_SCREENSHOTS, maxBytes: MAX_BYTES, reviewRequired };
}
