/** Posts per page: the start document shows one page and each scroll-triggered load appends one more. */
export const FEED_PAGE_SIZE = 10;

export type FeedItem = {
  id: string;
  position: number;
  title: string;
  author: string;
  /** ISO 8601 timestamp; newest first, derived from a fixed base date, never the clock. */
  published: string;
  summary: string;
};

const PUBLISHED_BASE_MS = Date.UTC(2026, 2, 1, 12, 0, 0);
const HOUR_MS = 3_600_000;
const topics = ["Harbor lights", "Trail report", "Kitchen notes", "Night market", "Workshop log", "Garden diary", "Transit watch", "Library finds", "Weather desk", "Studio update"];
const authors = ["Mara Quinn", "Theo Lindqvist", "Priya Raman", "Jonah Okafor", "Elena Varga", "Sam Whitlock", "Aiko Tanaka", "Rafael Ortiz"];
const openers = ["A quick look at", "Notes from", "Photos and thoughts on", "What we learned from", "A short thread about", "Updates on"];
const subjects = ["the morning ferry schedule", "the new community garden beds", "Saturday's repair cafe", "the riverside cycling loop", "the winter reading list", "the pop-up bakery on Elm Street", "the lantern festival rehearsals", "the rooftop weather station"];

/** The post at a 1-based feed position; content depends only on the seed and the position. */
export function feedItem(seed: number, position: number): FeedItem {
  const pick = <T>(values: readonly T[], salt: number): T => values[mix(seed, position, salt) % values.length] as T;
  const hoursAgo = position * 3 + (mix(seed, position, 5) % 3);
  return {
    id: `post-${position}`,
    position,
    title: `${pick(topics, 1)} #${position}`,
    author: pick(authors, 2),
    published: new Date(PUBLISHED_BASE_MS - hoursAgo * HOUR_MS).toISOString(),
    summary: `${pick(openers, 3)} ${pick(subjects, 4)}.`,
  };
}

/** The posts on a 1-based page of a feed that holds `feedLength` posts; empty past the end. */
export function feedPageItems(seed: number, page: number, feedLength: number): FeedItem[] {
  const first = (page - 1) * FEED_PAGE_SIZE + 1;
  const last = Math.min(page * FEED_PAGE_SIZE, feedLength);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => feedItem(seed, first + offset));
}

function mix(seed: number, position: number, salt: number): number {
  let value = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(position, 0xc2b2ae35) + Math.imul(salt, 0x27d4eb2f)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}
