import type { SubflowListing } from "@fluxiq/ui-components";
import { readCard } from "./card";
import { list, record } from "./values";

/** One page of the library: the cards that read, and where the next page starts. */
export function readListing(value: unknown): SubflowListing | undefined {
  const page = record(value);
  if (page === undefined || !Array.isArray(page.parts)) return undefined;
  const parts = list(page.parts).flatMap((item) => readCard(item) ?? []);
  const nextCursor = typeof page.nextCursor === "string" ? page.nextCursor : null;
  return { refused: false, parts, nextCursor, hasMore: page.hasMore === true && nextCursor !== null };
}
