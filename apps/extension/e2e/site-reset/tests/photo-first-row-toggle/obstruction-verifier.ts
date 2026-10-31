import { expect } from "../../../fixtures/extension-context";
import type { JudgeLog } from "../../change-proof";
import type { InstalledBuild } from "../../index";
import { likedPosts } from "../../photo-build";
import { countPhotoProviderCallbacks } from "./provider-count";

/** Controlled provider-free uncertainty keeps three real executions without bypassing first-confirmed-yes completion. */
export function photoObstructionVerifier(installed: InstalledBuild, judge: JudgeLog, likedCode: string, unlikeSelector: string) {
  let requested: "first" | "second" | "final" | undefined;
  const checks: Array<{ trial: string; liked: string[] }> = [];
  const counter = countPhotoProviderCallbacks(installed.service, async () => {
    if (!requested) throw new Error("diagnostic.verification_without_trial_request");
    await expect(installed.page.locator(unlikeSelector).first()).toBeVisible();
    const liked = await likedPosts(installed.page);
    expect(liked).toEqual([likedCode]);
    checks.push({ trial: requested, liked });
  });
  return {
    checks,
    request: (trial: "first" | "second" | "final") => { requested = trial; },
    restoreBinding: counter.restore,
    verify: (shown: string) => {
      const confirmed = judge.verify(shown);
      if (requested === "final") return confirmed;
      return { summary: "Controlled provider-free uncertainty for a completed trial; the fixture checks the actual site effect separately.",
        diagnosis: { answersRequest: "unknown", observed: "This scripted verifier deliberately withholds confirmation for this completed trial." } };
    }
  };
}
