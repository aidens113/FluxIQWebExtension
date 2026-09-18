import { REFERENCE_NOW_MS } from "./posts.js";
import type { ConnectedAccount, QueuedPost } from "./types.js";

/** The console's start page. Row links are written root-relative, so their text is the same on every run's port. */
export const SCHEDULER_ROOT = "/scenarios/social-scheduler/";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;
const MINUTES_PER_WEEK = 10_080;
/** How much of a post the queue cell shows before it cuts the rest off. */
const EXCERPT_LIMIT = 64;

/**
 * The exact slot, spelled the way the console spells it: "Thu 24 Sep 2026,
 * 14:30". Written from UTC parts rather than a locale format, so the text does
 * not move with the machine running the lab.
 */
export function slotText(offsetMinutes: number): string {
  const at = new Date(REFERENCE_NOW_MS + offsetMinutes * 60_000);
  const day = String(at.getUTCDate());
  const time = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
  return `${WEEKDAYS[at.getUTCDay()]} ${day} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}, ${time}`;
}

/**
 * The relative label beside the slot -- "In 3 hours", "Yesterday", "2 weeks
 * ago" -- which is what a person actually reads in a queue and what makes the
 * exact slot the only thing a table can be keyed on.
 */
export function relativeText(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "Now";
  const ahead = offsetMinutes > 0;
  const minutes = Math.abs(offsetMinutes);
  if (minutes < MINUTES_PER_HOUR) return ahead ? `In ${minutes} minutes` : `${minutes} minutes ago`;
  if (minutes < MINUTES_PER_DAY) return countLabel(ahead, Math.floor(minutes / MINUTES_PER_HOUR), "hour");
  if (minutes < 2 * MINUTES_PER_DAY) return ahead ? "Tomorrow" : "Yesterday";
  if (minutes < MINUTES_PER_WEEK) return countLabel(ahead, Math.floor(minutes / MINUTES_PER_DAY), "day");
  return countLabel(ahead, Math.floor(minutes / MINUTES_PER_WEEK), "week");
}

/**
 * What the queue shows of a post: the first words, cut at a word boundary,
 * with an ellipsis where the rest was. The whole post is on its own page and
 * in the cell's `title`, so the truncation is real and recoverable, exactly as
 * it is in a shipped console.
 */
export function excerptOf(body: string): string {
  if (body.length <= EXCERPT_LIMIT) return body;
  const cut = body.slice(0, EXCERPT_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The post cell's whole text: the excerpt, then the link chip when the post carries one. */
export function postCellText(post: QueuedPost): string {
  return post.link === "" ? excerptOf(post.body) : `${excerptOf(post.body)} ${post.link}`;
}

/** The scheduled cell's whole text: the relative label a person reads, then the exact slot beneath it. */
export function scheduledCellText(post: QueuedPost): string {
  return `${relativeText(post.offsetMinutes)} ${slotText(post.offsetMinutes)}`;
}

export function postPath(post: QueuedPost): string {
  return `${SCHEDULER_ROOT}posts/${post.id}`;
}

export function accountPath(account: ConnectedAccount): string {
  return `${SCHEDULER_ROOT}accounts/${account.slug}`;
}

function countLabel(ahead: boolean, count: number, unit: string): string {
  const measure = `${count} ${unit}${count === 1 ? "" : "s"}`;
  return ahead ? `In ${measure}` : `${measure} ago`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
