import { sha256 } from "./hash.js";
import { assertVerifiedVisual } from "./redaction.js";
import type { EvidenceBundle } from "./bundle.js";
import type { CapturedEvidenceEvent, CaptureEvidenceEventInput, CapturePolicy, CaptureScreenshot, ScreenshotAdapter } from "./types.js";

function shouldCapture(trigger: CaptureEvidenceEventInput["trigger"], policy: CapturePolicy): boolean {
  if (policy.screenshots === "none") return false;
  if (policy.screenshots === "events") return true;
  return trigger === "checkpoint" || trigger === "error" || trigger === "final";
}

export class EvidenceCaptureController {
  private lastCaptureAt = Number.NEGATIVE_INFINITY;
  private capturedCount = 0;
  private capturedBytes = 0;
  private readonly hashes = new Map<string, string>();

  constructor(
    private readonly bundle: EvidenceBundle,
    private readonly policy: CapturePolicy,
    private readonly adapter?: ScreenshotAdapter,
    private readonly nowMs: () => number = Date.now,
  ) { this.bundle.registerEvidencePolicy(policy); }

  async trigger(input: CaptureEvidenceEventInput): Promise<CapturedEvidenceEvent> {
    let screenshot: CaptureScreenshot;
    if (!shouldCapture(input.trigger, this.policy)) screenshot = { suppressed: "policy" };
    else if (!this.adapter) screenshot = { suppressed: "capture-unavailable" };
    else if (this.capturedCount >= this.policy.maxScreenshots || this.capturedBytes >= this.policy.maxBytes) screenshot = { suppressed: "quota" };
    else if (this.nowMs() - this.lastCaptureAt < (this.policy.minimumScreenshotIntervalMs ?? 0) && input.trigger !== "error") screenshot = { suppressed: "rate-limit" };
    else {
      const visual = await this.adapter.capture(input);
      if (!visual) screenshot = { suppressed: "capture-unavailable" };
      else {
        assertVerifiedVisual(visual);
        this.lastCaptureAt = this.nowMs();
        const digest = sha256(visual.bytes);
        const priorPath = this.hashes.get(digest);
        if (priorPath) screenshot = { sha256: digest, duplicateOfSha256: digest };
        else if (this.capturedBytes + visual.bytes.byteLength > this.policy.maxBytes) screenshot = { suppressed: "quota" };
        else {
          const extension = visual.mediaType === "image/png" ? "png" : visual.mediaType === "image/jpeg" ? "jpg" : "webp";
          const sequence = this.bundle.getEvents().length + 1;
          const relativePath = `screenshots/${String(sequence).padStart(5, "0")}-${digest.slice(0, 12)}.${extension}`;
          await this.bundle.writeVerifiedVisual(relativePath, visual);
          this.hashes.set(digest, relativePath);
          this.capturedCount += 1;
          this.capturedBytes += visual.bytes.byteLength;
          screenshot = { path: relativePath, sha256: digest };
        }
      }
    }
    return this.bundle.appendEvent({ ...input, screenshot });
  }
}
