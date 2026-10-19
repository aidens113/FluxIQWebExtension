// Whether a list read of one page saw a list that goes on past it (C2), beside
// the rest of its summary (`./summary.ts`): two closed words, copied word by
// word, so nothing read off the page can ride on it.
//
// **It exists because a read of one page cannot say so by its counts.** Live
// run `run-mveaaqxn-d0be9888` read 5 posts of a feed that went on loading as it
// was scrolled, kept 1, and its builder was told only that the counts looked
// right; three revisions repeated the same read of one page. The page had said
// the list went on -- the reader's own feed signal (`feed-signal.ts` in the
// extension) -- and nothing carried it. A read of one page reads one page by
// design; what it owes is to say, as a fact, that the list visibly continues.

/**
 * How a list read of one page saw its list go on past what it read.
 *
 * `kind` is how the list continues: `next_page` (a control to its next page,
 * labelled or numbered), `load_more` (a control that appends more of it), or
 * `infinite_scroll` (the page declares a list that loads more as it is
 * scrolled). `evidence` is what said so: `next_control`, an enabled control
 * labelled as the next page; `following_page_number`, the enabled page number
 * after the one marked current; `load_more_control`, an enabled load-more
 * control; `declared_feed`, a list the page declares longer than it shows (a
 * feed role, an unknown set size, or a declared row count larger than the rows
 * shown) that was still growing when the read's reveal ran out;
 * `still_growing`, an undeclared list still growing then. A declared feed that
 * stopped growing is a feed that showed its end, and sends nothing.
 *
 * Absent from a read that paged, and from one whose list showed no way on or
 * showed one disabled -- a list that ended.
 */
export type WebAutomationExtractionListContinues = {
  kind: "next_page" | "load_more" | "infinite_scroll";
  evidence: "next_control" | "following_page_number" | "load_more_control" | "declared_feed" | "still_growing";
};

const KINDS: ReadonlySet<string> = new Set(["next_page", "load_more", "infinite_scroll"]);
const EVIDENCE: ReadonlySet<string> = new Set(["next_control", "following_page_number", "load_more_control", "declared_feed", "still_growing"]);

/** The fact copied word by word, or `undefined` for one that is not well formed. */
export function webAutomationExtractionListContinuesValue(value: unknown): WebAutomationExtractionListContinues | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const fact = value as Record<string, unknown>;
  if (typeof fact.kind !== "string" || !KINDS.has(fact.kind)) return undefined;
  if (typeof fact.evidence !== "string" || !EVIDENCE.has(fact.evidence)) return undefined;
  return { kind: fact.kind, evidence: fact.evidence } as WebAutomationExtractionListContinues;
}
