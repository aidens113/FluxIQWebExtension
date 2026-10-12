import type { Locator } from "@playwright/test";

const PROBE_MS = 1_000;

/**
 * Why an action on `target` cannot happen right now, in Playwright's own
 * words: a trial click, which runs every actionability check -- attached,
 * visible, stable, enabled, and not covered by another element -- and then
 * clicks nothing. Its call log names the element lying over the target, which
 * is what a step that ran out of time most often needs to say.
 */
export async function diagnoseAction(target: Locator): Promise<string> {
  try {
    await target.click({ trial: true, timeout: PROBE_MS });
    return "The target is actionable now.";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `A trial click now says: ${message}`;
  }
}
