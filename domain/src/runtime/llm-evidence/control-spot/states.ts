// Every visible stateful control of a read, by place and state (L1 reset
// settlement, "Control states"): for each control place on the page, how many
// controls there show each state. Core reads it as `controls` on a start-state
// answer, and the step diff carries one place's counts before and after the
// step (`../../state-diff/places/diff.ts`).

import type { WebLlmSnapshotBinding } from "../sanitize";
import { webControlPlace } from "./place";
import { webControlState } from "./state";

type Page = Pick<WebLlmSnapshotBinding, "records"> & Partial<Pick<WebLlmSnapshotBinding, "evidence" | "subjects" | "resetResource">>;

/** Core's bound on a read's places (`site-reset/start-check.ts`): a read with more is none it takes. */
const MAX_PLACES = 2_000;

/** The counts of each state at each place of `page`; empty where the page has none, no trusted source, or more places than Core reads. */
export function webControlStates(page: Page): Record<string, Record<string, number>> {
  const controls: Record<string, Record<string, number>> = {};
  let places = 0;
  for (const element of page.evidence?.elements ?? []) {
    const place = webControlPlace(page, element.target);
    if (place === undefined) continue;
    let counts = controls[place];
    if (counts === undefined) {
      if ((places += 1) > MAX_PLACES) return {};
      counts = controls[place] = {};
    }
    const state = webControlState(element);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return controls;
}
