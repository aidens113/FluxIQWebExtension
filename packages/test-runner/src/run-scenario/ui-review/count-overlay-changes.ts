import type { OverlayChangeCounts, OverlaySample } from "./types.js";

/**
 * What one window of overlay samples shows: how often its text changed, how
 * often it came and went, and whether that reads as stable or flickering.
 *
 * A failed read is counted and skipped, never taken as "absent": a sample that
 * could not be read says nothing about the overlay, and treating it as absent
 * would invent a presence toggle on either side of it. Text is compared only
 * between present samples, so an overlay that disappears and comes back with
 * the same status is one pair of presence toggles, not two text changes.
 *
 * A status that returns to one already shown earlier in the window (A, B, A)
 * is a revisit: that is what a status switching back and forth looks like at
 * a sampling interval longer than the switch.
 *
 * Every change of document (`documentOrigin`) between one sample and the
 * next one that names its document is a page load, counted in `pageLoads`
 * whether or not the overlay was absent across it: a swap with the overlay
 * present in every sample is still the tab loading a new page. A failed read
 * names a document too when one was re-read after it (`readOverlaySample`),
 * so a navigation that ends a window in a failed read is counted
 * (run-musp8nz1 moment 2, D13).
 *
 * A window that ends in a failure shaped like a navigation
 * (`navigationSuspected`) with nothing after it naming a new document, or a
 * later read of the same one, is one `probablePageLoads`: a load that probably
 * began and that nothing in the window could prove, kept apart from
 * `pageLoads`.
 *
 * One absent sample whose immediate neighbours are both readable, present and
 * read from different documents is that swap's gap, which the overlay cannot
 * outlive. It is counted as `pageLoadGaps` and skipped, so it makes no
 * presence or visibility toggle. Any other absence counts as before: two or
 * more samples, one inside a single document, or one beside a failed read or a
 * sample that names no document.
 */
export function countOverlayChanges(samples: readonly OverlaySample[]): OverlayChangeCounts {
  let readFailures = 0, presentSamples = 0, visibleSamples = 0, textChanges = 0, presenceToggles = 0, visibilityToggles = 0, textRevisits = 0;
  let previous: OverlaySample | undefined;
  let lastText: string | undefined;
  const seen = new Set<string>();
  let pageLoads = 0, pageLoadGaps = 0;
  let lastOrigin: number | undefined;
  // A navigation-shaped failure that no later sample has yet settled: one naming a new document, or the same one.
  let unsettledNavigation = false;
  for (const [index, sample] of samples.entries()) {
    const newDocument = typeof sample.documentOrigin === "number" && lastOrigin !== undefined && sample.documentOrigin !== lastOrigin;
    if (newDocument) pageLoads += 1;
    if (typeof sample.documentOrigin === "number") lastOrigin = sample.documentOrigin;
    if (sample.error !== undefined) {
      readFailures += 1;
      if (sample.navigationSuspected === true) unsettledNavigation = !newDocument;
      else if (newDocument) unsettledNavigation = false;
      continue;
    }
    if (typeof sample.documentOrigin === "number") unsettledNavigation = false;
    if (isPageLoadGap(samples, index)) { pageLoadGaps += 1; continue; }
    if (sample.present) presentSamples += 1;
    if (sample.visible) visibleSamples += 1;
    if (previous) {
      if (previous.present !== sample.present) presenceToggles += 1;
      if (previous.visible !== sample.visible) visibilityToggles += 1;
    }
    previous = sample;
    if (!sample.present) continue;
    const text = sample.text ?? "";
    if (lastText !== undefined && text !== lastText) {
      textChanges += 1;
      if (seen.has(text)) textRevisits += 1;
    }
    seen.add(text);
    lastText = text;
  }
  const status: OverlayChangeCounts["status"] = presentSamples === 0 ? "absent"
    : textRevisits >= 1 || presenceToggles >= 2 || visibilityToggles >= 2 || textChanges >= 3 ? "flickering"
      : textChanges + presenceToggles + visibilityToggles > 0 ? "changed" : "stable";
  return { samples: samples.length, readFailures, presentSamples, visibleSamples, textChanges, presenceToggles, visibilityToggles, textRevisits, distinctTexts: seen.size, pageLoads, pageLoadGaps, probablePageLoads: unsettledNavigation ? 1 : 0, status };
}

function isPageLoadGap(samples: readonly OverlaySample[], index: number): boolean {
  const before = samples[index - 1], gap = samples[index], after = samples[index + 1];
  if (!before || !gap || !after || gap.present) return false;
  const readable = (sample: OverlaySample) => sample.error === undefined && sample.present && typeof sample.documentOrigin === "number";
  return readable(before) && readable(after) && before.documentOrigin !== after.documentOrigin;
}
