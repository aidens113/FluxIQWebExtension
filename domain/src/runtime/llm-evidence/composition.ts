// What a packet was made of, counted and nothing else: how many elements of
// each of the capture's relevance bands the model was actually shown, and how
// many the packet left behind.
//
// Why this exists. Live run `run-muexhp0k-73172f73` built a Flow that failed to
// click a "Brightaisle Plus" filter the instruction told it to use, and no
// artifact of that run could say whether the model had ever been shown the
// filter. `evaluation.json` held `sanitizedPacketBytes` and `truncationCount`;
// `snapshots/live-llm.json` recorded `"perCallRecords": "not recorded"`. A byte
// size says a packet was 4,071 bytes long. It does not say whether the one
// control the instruction named was among the forty elements inside it, so the
// first question anyone asks about such a failure -- was the model told what it
// should have been told -- was unanswerable.
//
// A count is not page content, which is the whole reason this is safe to
// record and the reason it must stay counts. Nothing here reads a name, a
// text, a selector or an attribute; the only thing read off an element is the
// band number the capture stamped on it
// (`apps/extension/src/content/dom-snapshot.ts` `snapshotElementBucket`), and
// the only thing published is how many elements carried each one. The packet is
// what a language model reads, so a field on it that could carry a word of the
// page would be a leak by another name.
//
// Why the bands are numbers rather than names. The bands are defined once, by
// the capture, and naming them here would be a second copy to keep in step: a
// band renamed on the page's side would go on being reported under the old
// name, and the reader would be told something false with no way to notice.
// Band 1 is the one this was built for -- the controls that change what the
// page shows, a facet, a price band, a sort order, a pager -- and it is band 1
// on both sides of the wire.
//
// Why `dropped` is one number and not three. An element can miss the packet
// three ways: the element bound cut the ranked tail, the sanitizer refused to
// describe it (no selector, or a signature that says it holds a secret), or the
// byte budget trimmed it back out. They are different problems, but to the
// question this answers they are one answer -- the model was not shown it --
// and splitting them would invite a reader to conclude that a band was
// "present" because only one of the three fired on it.

import { boundedCount, isJsonRecord } from "./untrusted-json";

/**
 * The counts, keyed by the capture's band number written in decimal. Only
 * bands with at least one element appear, so a packet from a small page costs a
 * few bytes rather than a fixed table of zeroes.
 *
 * `unranked` is the one key that is not a number: it counts elements the
 * capture stamped no band on, which is a capture older than this field or a
 * malformed one. It is here so the two sides always add up -- without it a
 * reader could not tell "no band 1 elements on this page" from "this producer
 * says nothing about bands" -- and a reader that sees it should trust the rest
 * of the histogram less, not more.
 */
export type WebLlmEvidenceBandCounts = Record<string, number>;

/**
 * What the packet described, and what the page offered that it did not.
 *
 * `included` counts the elements of the packet as it is sent, so it is
 * recounted after every trim rather than measured once at the top.
 * `dropped` is the rest of what the capture offered: `included` plus `dropped`
 * is every element the capture put in front of the packet builder.
 */
export type WebLlmEvidenceComposition = {
  included: WebLlmEvidenceBandCounts;
  dropped: WebLlmEvidenceBandCounts;
};

/**
 * The key `unranked` elements are counted under. Not a number, deliberately: a
 * sentinel band number would read as a band the capture has, and a reader
 * comparing it against `snapshotElementBucket` would find nothing there.
 */
export const WEB_LLM_EVIDENCE_UNRANKED_BAND = "unranked" as const;

/**
 * More bands than the capture defines, by a wide margin. The bound exists only
 * so a hostile or broken capture cannot make the histogram's keys unbounded;
 * it is not a statement about how many bands there are.
 */
const MAX_BAND = 1_000;

/** The band a raw capture element carries, as a histogram key. */
export function evidenceBandKey(raw: unknown): string {
  if (!isJsonRecord(raw)) return WEB_LLM_EVIDENCE_UNRANKED_BAND;
  const band = boundedCount(raw.snapshotBucket, MAX_BAND);
  return band === undefined ? WEB_LLM_EVIDENCE_UNRANKED_BAND : String(band);
}

/**
 * Counts every element the capture offered, once, and then answers what the
 * packet is made of for whatever set of elements it currently holds.
 *
 * Built as a counter over the offered elements rather than as a function of
 * two lists because the offered side is fixed the moment the capture arrives
 * while the packet's own side changes under the trim ladder, and recomputing
 * the offered side on every pop would be a walk of the whole capture per
 * removed element.
 */
export function webLlmEvidenceComposition(offered: readonly unknown[]): {
  (includedBands: readonly string[]): WebLlmEvidenceComposition;
} {
  const offeredCounts = new Map<string, number>();
  for (const raw of offered) {
    const key = evidenceBandKey(raw);
    offeredCounts.set(key, (offeredCounts.get(key) ?? 0) + 1);
  }
  return (includedBands) => {
    const included = new Map<string, number>();
    for (const key of includedBands) included.set(key, (included.get(key) ?? 0) + 1);
    const composition: WebLlmEvidenceComposition = { included: {}, dropped: {} };
    for (const [key, total] of [...offeredCounts.entries()].sort(byBand)) {
      const kept = included.get(key) ?? 0;
      if (kept) composition.included[key] = kept;
      // A band is named on the dropped side only when something of it was
      // actually dropped, so an untruncated packet says `dropped: {}` rather
      // than a row of zeroes the reader has to scan past.
      if (total - kept > 0) composition.dropped[key] = total - kept;
    }
    return composition;
  };
}

/** Numbered bands in their own order, lowest first, with `unranked` after all of them. */
function byBand([left]: readonly [string, number], [right]: readonly [string, number]): number {
  if (left === WEB_LLM_EVIDENCE_UNRANKED_BAND) return 1;
  if (right === WEB_LLM_EVIDENCE_UNRANKED_BAND) return -1;
  return Number(left) - Number(right);
}
