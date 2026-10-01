// A control whose name carries state, read by the part of the name that does
// not change.
//
// ## The defect this closes
//
// The bigbox store chooser's chip is one button holding two spans: the label
// "Pickup or delivery?" and the name of the store the shopper has chosen
// (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts`). Its
// accessible name is its content, so the name *is* the state: a recording made
// with Carden Falls Supercenter chosen names the chip "Pickup or
// delivery?Carden Falls Supercenter", and once the shopper has switched to
// Millbrook the same chip is "Pickup or delivery?Millbrook Crossing
// Supercenter". Live run `run-munri5gr-94d7f8a0` switched it during
// exploration, and both dry runs then met the chip under the new name: the
// recorded selector found it, the veto (`veto.ts`) weighed it, and nothing the
// recording named agreed exactly -- the name and the text both differ -- so it
// was refused, Level 2 refused it for the same reason, and the step came back
// `unreproducible` after the recovery ladder's five seconds. A Flow that
// changes the store is refused on its second run for having worked on its
// first.
//
// ## The reading
//
// A name taken from content is built from the content's text runs, and a page
// that shows state inside a control shows it as a run of its own -- a span with
// the store, the count, the account name. So the candidate's text runs are the
// boundaries a changing part can have, and this reads the recording against
// them: the recorded name must be the candidate's runs with **exactly one run
// replaced** by something else. What is left -- the runs before and after it --
// is the stable part, and both the recording and the candidate are then
// described by that part alone, for Core to score as it scores anything
// (`score.ts`, `corroboration.ts`). Nothing here decides a match; it only says
// what the match is to be decided on.
//
// ## Why it does not reach another button
//
// Narrow by construction, because the veto's rule 2 exists to refuse a
// different action with a similar label:
//
// - the candidate must be named by its content, in at least two runs, so a
//   one-run "Delete" never reads as a changed "Delete workspace" -- Core's
//   containment rung, which `corroboration.ts` refuses, is not reopened here;
// - the replaced part must be a whole run, never part of one, and the recording
//   must have held something else there, not nothing;
// - what is kept must be words, not a glyph or a number;
// - one reading or none: runs that fit the recording in two places read as
//   neither.
//
// And it is not acted on here. `action-runtime/resolve-target.ts` asks for this
// reading only for the one element an exact strategy found in the recorded
// scope after the veto refused it, and acts only when the reading passes the
// veto's own rules *and* no other visible control of the family in that scope
// reads the same way. A second chip, or a list of buttons that share a label
// and differ in one run, is a tie, not a match.

import { isSensitiveFormControl } from "../element-traits";
import { accessibleNameFor } from "./accessible-name";
import { normalizedText } from "./normalized-text";
import { candidateFingerprint, type TargetCandidate } from "./candidates";
import type { RecordedIdentity } from "./score";

/** The recording and a candidate, both described by the part of the name that does not change. */
export type StableNameReading = {
  recorded: RecordedIdentity;
  candidate: TargetCandidate;
  /** The kept part, which the recording and the candidate now both carry as their name. */
  stable: string;
};

/** Text runs a control's name may be read in. A chip holds two or three; a control holding more is a region. */
const MAX_RUNS = 8;
/** Nodes walked for them. A control is small; one that is not is not read. */
const MAX_NODES = 64;
/** Letters the kept part must hold: words, not a glyph, a price or a count. */
const MIN_STABLE_LETTERS = 3;

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/**
 * The reading of `target` against `element` by the stable part of its name, or
 * `undefined` when there is none: the recording named nothing, the element is
 * not named by its content, or its runs fit the recording in no place or in
 * more than one.
 */
export function stableNameReading(target: RecordedIdentity, element: Element): StableNameReading | undefined {
  const recorded = recordedName(target);
  if (!recorded) return undefined;
  const runs = textRuns(element);
  if (!runs || runs.length < 2) return undefined;
  // Named by its content and nothing else: an authored name is not built from
  // runs, so a run cannot be the part of it that changed.
  if (accessibleNameFor(element) !== normalizedText(runs.join(""))) return undefined;
  const readings = new Set<string>();
  for (let index = 0; index < runs.length; index += 1) {
    const stable = keptAround(recorded, runs, index);
    if (stable) readings.add(stable);
  }
  const [stable] = readings;
  if (readings.size !== 1 || stable === undefined) return undefined;
  const fingerprint = candidateFingerprint(element, 0);
  return {
    stable,
    recorded: {
      ...target,
      ...(target.accessibleName ? { accessibleName: stable } : {}),
      ...(target.visibleText ? { visibleText: stable } : {})
    },
    candidate: {
      element,
      fingerprint: {
        ...fingerprint,
        ...(fingerprint.accessibleName ? { accessibleName: stable } : {}),
        ...(fingerprint.visibleText ? { visibleText: stable } : {})
      }
    }
  };
}

/**
 * The one name the recording gave the control. A recording whose text and name
 * disagree named two things, and there is no single part of one name to keep.
 */
function recordedName(target: RecordedIdentity): string | undefined {
  const name = normalizedText(target.accessibleName);
  const text = normalizedText(target.visibleText);
  if (name && text && name !== text) return undefined;
  return name ?? text;
}

/**
 * The stable part when run `index` is the one that changed: the runs before it
 * and after it, which the recorded name must begin and end with, around
 * something other than what the run says now.
 */
function keptAround(recorded: string, runs: readonly string[], index: number): string | undefined {
  const before = normalizedText(runs.slice(0, index).join("")) ?? "";
  const after = normalizedText(runs.slice(index + 1).join("")) ?? "";
  const now = normalizedText(runs[index]);
  if (before.length + after.length >= recorded.length) return undefined;
  if (!recorded.startsWith(before) || !recorded.endsWith(after)) return undefined;
  const then = recorded.slice(before.length, recorded.length - after.length).trim();
  if (!then || then === now) return undefined;
  const stable = normalizedText([before, after].filter(Boolean).join(" "));
  return stable && letters(stable) >= MIN_STABLE_LETTERS ? stable : undefined;
}

/**
 * The element's text runs in document order: each text node that holds more
 * than whitespace, raw, with the whitespace-only nodes between them kept on the
 * run before -- so joined they are exactly the text its name was built from.
 * `undefined` when the element is too large to be one control, or holds a
 * sensitive control, whose words are never a name.
 */
function textRuns(element: Element): string[] | undefined {
  const runs: string[] = [];
  let leading = "";
  const pending: Node[] = childrenInReverse(element);
  let budget = MAX_NODES;
  for (let node = pending.pop(); node; node = pending.pop()) {
    budget -= 1;
    if (budget < 0) return undefined;
    if (node.nodeType === TEXT_NODE) {
      const value = node.nodeValue ?? "";
      if (/\S/u.test(value)) {
        runs.push(leading + value);
        leading = "";
      } else if (runs.length) runs[runs.length - 1] += value;
      else leading += value;
      if (runs.length > MAX_RUNS) return undefined;
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    if (isSensitiveFormControl(node as Element)) return undefined;
    pending.push(...childrenInReverse(node));
  }
  return runs;
}

/** A node's children, last first, so a stack walks them in document order. */
function childrenInReverse(node: Node): Node[] {
  return [...node.childNodes].reverse();
}

function letters(value: string): number {
  return value.match(/\p{L}/gu)?.length ?? 0;
}
