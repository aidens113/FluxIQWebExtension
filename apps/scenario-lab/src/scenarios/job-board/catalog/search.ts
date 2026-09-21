import type { JobBoardMode, Posting } from "../types.js";
import { POSTINGS } from "./postings.js";
import type { SearchQuery } from "./search-query.js";

const TYPE_NAMES = { fulltime: "Full-time", contract: "Contract", parttime: "Part-time" } as const;

/**
 * Postings the board carries under a rendering. `quiet-market` is a week with
 * no remote Rust hiring, so every remote posting that a search for "rust"
 * would find -- by title, company or snippet, substring and all -- is gone.
 */
export function availablePostings(mode: JobBoardMode): Posting[] {
  if (mode !== "quiet-market") return [...POSTINGS];
  return POSTINGS.filter((posting) => !(posting.workplace === "remote" && haystack(posting).includes("rust")));
}

/**
 * The organic results for `query`, in the order the chosen sort lists them.
 * Words must all appear, anywhere in the title, company or snippet, and as
 * substrings: the board's search has no idea of words, which is why "rust"
 * finds a Trust & Safety role. The salary filter keeps a yearly pound salary
 * whose top reaches the floor, the way job boards match a range against a
 * minimum. A closed posting never lists; the fresh one lists once it is live.
 */
export function searchPostings(mode: JobBoardMode, query: SearchQuery, freshLive: boolean): Posting[] {
  const tokens = words(query.q);
  const where = query.l.toLowerCase();
  const matched = availablePostings(mode).filter((posting) => {
    if (posting.closed || (posting.fresh && !freshLive)) return false;
    if (!tokens.every((token) => haystack(posting).includes(token))) return false;
    if (where && !posting.location.toLowerCase().includes(where)) return false;
    return passesFilters(posting, query);
  });
  if (query.sort === "relevance") return matched;
  return matched
    .map((posting, rank) => ({ posting, rank }))
    .sort((a, b) => a.posting.postedHours - b.posting.postedHours || a.rank - b.rank)
    .map(({ posting }) => posting);
}

/** One page of `results`, with the page number clamped to the pages there are. */
export function pageOfResults(results: readonly Posting[], query: SearchQuery): { items: Posting[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(results.length / query.limit));
  const page = Math.min(query.page, pages);
  return { items: results.slice((page - 1) * query.limit, page * query.limit), page, pages };
}

/**
 * What the board offers when a search finds nothing: up to three postings the
 * words match without the filters, then postings the filters match without
 * the words, six in all -- in the same cards the real results use.
 */
export function recommendationsFor(mode: JobBoardMode, query: SearchQuery): Posting[] {
  const tokens = words(query.q);
  const open = availablePostings(mode).filter((posting) => !posting.closed && !posting.fresh);
  const byWords = tokens.length === 0 ? [] : open.filter((posting) => tokens.every((token) => haystack(posting).includes(token))).slice(0, 3);
  const byFilters = open.filter((posting) => !byWords.includes(posting) && passesFilters(posting, query));
  return [...byWords, ...byFilters].slice(0, 6);
}

/** The words a search looks through. */
export function haystack(posting: Posting): string {
  return `${posting.title} ${posting.company} ${posting.snippet}`.toLowerCase();
}

function words(text: string): string[] {
  return text.toLowerCase().split(/\s+/u).filter(Boolean);
}

function passesFilters(posting: Posting, query: SearchQuery): boolean {
  if (query.wp && posting.workplace !== query.wp) return false;
  if (query.type && posting.jobType !== TYPE_NAMES[query.type]) return false;
  if (query.age && posting.postedHours > Number(query.age) * 24) return false;
  if (query.sal) {
    const { period, currency, min, max } = posting.salary;
    const top = max ?? min;
    if (period !== "year" || currency !== "GBP" || top === null || top < Number(query.sal)) return false;
  }
  return true;
}
