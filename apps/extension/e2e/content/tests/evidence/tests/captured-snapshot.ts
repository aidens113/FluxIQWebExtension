// The snapshot as the content script actually builds it, and the two readers
// every evidence spec takes it through.
//
// It sits here because all four evidence specs need it: the rows asserted on a
// page at rest, the items the snapshot carries beside `evidence`, the items a
// page at rest cannot show, and the sensitive-input rows. The protocol type
// alone will not do -- `content/types.ts` widens a descriptor with two activity
// flags and hangs `evidence` off the snapshot, and it is those additions the
// rows are about.

import type { ContentHarness } from "../../../index.js";
import type { PageEvidence } from "../../../../../src/content/evidence/index.js";
import type { DomSnapshot } from "../../../../../src/shared/protocol.js";

/** A descriptor plus the two activity flags `content/types.ts` widens it by. */
export type CapturedElement = DomSnapshot["interactiveElements"][number] & {
  changed?: boolean | undefined;
  recentlyInteracted?: boolean | undefined;
};

/** The snapshot as the content script builds it: the protocol shape plus what `content/types.ts` widens it by. */
export type CapturedSnapshot = Omit<DomSnapshot, "interactiveElements"> & {
  evidence?: PageEvidence | undefined;
  interactiveElements: CapturedElement[];
};

export async function capture(harness: ContentHarness): Promise<CapturedSnapshot> {
  return await harness.capture() as CapturedSnapshot;
}

export async function evidenceOf(harness: ContentHarness): Promise<PageEvidence> {
  const snapshot = await capture(harness);
  const evidence = snapshot.evidence;
  if (!evidence) throw new Error(`The snapshot of ${harness.scenarioId} carried no page evidence.`);
  return evidence;
}
