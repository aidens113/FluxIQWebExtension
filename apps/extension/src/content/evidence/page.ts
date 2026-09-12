// The page-level evidence of one snapshot, assembled.
//
// Each item is gathered by the module that owns it; this is only the order they
// are asked in and the rule for what is left out. Collections that found
// nothing are omitted rather than sent as empty arrays: a snapshot is taken on
// every action result, and a page with no dialogs, no overlays and no repeating
// structure should cost nothing to say so.
//
// Element activity is marked here rather than in `dom-snapshot.ts` because the
// same pass produces the two descriptor flags and two of the totals, and
// splitting it would mean walking the descriptors twice.

import { markElementActivity, type SnapshotElementEntry } from "./changes";
import { dialogEvidence } from "./dialogs";
import { formEvidence } from "./forms";
import { recentlyInteractedElements } from "./interactions";
import { loadingEvidence } from "./loading";
import { navigationEvidence } from "./navigation";
import { overlayEvidence } from "./overlays";
import { present } from "../../shared/present";
import { regionEvidence } from "./regions";
import { repeatingEvidence } from "./repeating";
import type { PageEvidence } from "./types";

/** What the snapshot counted on its way to the descriptors it kept. */
export type SnapshotElementCounts = {
  /** Elements the generic sweep walked, before any filter. */
  scanned: number;
  /** Distinct candidates gathered across every pass. */
  candidates: number;
  /** Candidates that passed the inclusion filter, before the cap. */
  matched: number;
};

/**
 * The evidence for this capture. `entries` are the descriptors the snapshot
 * kept, paired with the elements they came from, and their `changed` and
 * `recentlyInteracted` flags are set as a side effect of building the totals.
 */
export function pageEvidence(entries: readonly SnapshotElementEntry[], counts: SnapshotElementCounts): PageEvidence {
  const activity = markElementActivity(entries, recentlyInteractedElements());
  const dialogs = dialogEvidence();
  const overlays = overlayEvidence(entries.map((entry) => entry.element));
  const regions = regionEvidence();
  const repeating = repeatingEvidence();
  const forms = formEvidence();
  return present<PageEvidence>({
    elements: {
      scanned: counts.scanned,
      candidates: counts.candidates,
      matched: counts.matched,
      returned: entries.length,
      truncated: counts.matched > entries.length,
      changed: activity.changed,
      recentlyInteracted: activity.recentlyInteracted
    },
    loading: loadingEvidence(),
    navigation: navigationEvidence(),
    dialogs,
    overlays,
    regions,
    repeating,
    forms
  });
}
