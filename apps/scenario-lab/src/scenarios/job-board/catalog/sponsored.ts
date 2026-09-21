import type { JobBoardMode, Posting } from "../types.js";
import { jobKey } from "./job-key.js";
import { availablePostings } from "./search.js";
import type { SearchQuery } from "./search-query.js";

/**
 * Promoted postings. A results page carries two, one above the first result
 * and one after the fifth, and they ignore every filter the person set: a
 * sponsor pays for the words, not the filters. Some are the very posting that
 * also lists organically, so a page can show the same job twice; others are
 * the lookalikes a sponsor would buy the words for.
 */
const POOLS: ReadonlyArray<{ word: string; ids: readonly string[] }> = [
  { word: "rust", ids: ["m1", "d15", "h3", "d7"] },
  { word: "halvard", ids: ["m5", "hl1"] },
];
const GENERAL_POOL = ["g1", "g8", "g3"] as const;

/** The sponsored postings on page `page` of `query`: first the one above the results, then the one inside them. */
export function sponsoredFor(mode: JobBoardMode, query: SearchQuery, page: number): Posting[] {
  const words = query.q.toLowerCase();
  const ids = POOLS.find((pool) => words.includes(pool.word))?.ids ?? GENERAL_POOL;
  const available = availablePostings(mode);
  const pool = ids.flatMap((id) => available.filter((posting) => posting.id === id && !posting.closed));
  if (pool.length === 0) return [];
  const start = ((page - 1) * 2) % pool.length;
  if (pool.length === 1) return [pool[0]!];
  return [pool[start]!, pool[(start + 1) % pool.length]!];
}

/** The opaque ad id a sponsored card's link carries for `posting`; the click redirect maps it back. */
export function adKey(posting: Posting): string {
  return jobKey(`ad:${posting.id}`);
}
