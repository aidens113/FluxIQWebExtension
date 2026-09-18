import { REFERENCE_NOW_MS } from "./conversations.js";
import type { Conversation, Correspondent } from "./types.js";

/** The inbox's start page. Row links are written root-relative, so their text is the same on every run's port. */
export const INBOX_ROOT = "/scenarios/social-inbox/";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;
const MINUTES_PER_WEEK = 10_080;
/** How much of a message the row shows before it cuts the rest off. */
const EXCERPT_LIMIT = 72;

/**
 * The Age column, written the terse way an inbox writes it: "25m", "4h",
 * "2d", "3w". That is all a person sees, and the exact moment lives on the
 * conversation's own page, so a run asked for ages reports ages.
 */
export function ageText(ageMinutes: number): string {
  if (ageMinutes < MINUTES_PER_HOUR) return `${ageMinutes}m`;
  if (ageMinutes < MINUTES_PER_DAY) return `${Math.floor(ageMinutes / MINUTES_PER_HOUR)}h`;
  if (ageMinutes < MINUTES_PER_WEEK) return `${Math.floor(ageMinutes / MINUTES_PER_DAY)}d`;
  return `${Math.floor(ageMinutes / MINUTES_PER_WEEK)}w`;
}

/**
 * When it actually arrived: "Mon 21 Sep 2026, 05:00". Written from UTC parts
 * rather than a locale format, so the text does not move with the machine
 * running the lab. The row keeps it in a `title`; the conversation's page
 * shows it.
 */
export function receivedText(ageMinutes: number): string {
  const at = new Date(REFERENCE_NOW_MS - ageMinutes * 60_000);
  const time = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
  return `${WEEKDAYS[at.getUTCDay()]} ${String(at.getUTCDate())} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}, ${time}`;
}

/** What the row shows of a message: the first words, cut at a word boundary, with an ellipsis where the rest was. */
export function messageExcerpt(message: string): string {
  if (message.length <= EXCERPT_LIMIT) return message;
  const cut = message.slice(0, EXCERPT_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The From cell's whole text, with the avatar letters first because an initials avatar is text in the cell like everything else. */
export function authorCellText(author: Correspondent): string {
  return `${author.initials} ${author.name} ${author.handle}`;
}

/** The Assigned cell's text: the teammate dealing with it, or the dash the inbox shows when nobody is. */
export function assigneeCellText(conversation: Conversation): string {
  return conversation.assignee === "" ? "—" : conversation.assignee;
}

export function conversationPath(id: string): string {
  return `${INBOX_ROOT}conversations/${id}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
