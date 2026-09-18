import { inboxAccountById, inboxAccountCellText } from "./accounts.js";
import { INBOX_PAGE_SIZE } from "./conversations.js";
import { INBOX_KIND_OPTIONS, INBOX_STATUS_OPTIONS, type InboxOption } from "./options.js";
import type { Conversation, InboxFilters, InboxState } from "./types.js";

const MINUTES_PER_DAY = 1_440;
const MINUTES_PER_WEEK = 10_080;
/** Nothing sent to the page can ask for a page past the inbox, however many pages it asks for. */
const MAX_PAGE = 100;

/**
 * The inbox after the run's own changes: a conversation the run replied to or
 * marked handled reads Handled, and one it handed on reads Assigned with the
 * teammate's name. Used for the page and for the oracle, so the two cannot
 * disagree.
 */
export function applyInboxChanges(conversations: readonly Conversation[], state: Pick<InboxState, "replies" | "handled" | "assigned">): Conversation[] {
  const answered = new Set([...state.replies.map(({ id }) => id), ...state.handled]);
  const handedTo = new Map(state.assigned.map(({ id, to }) => [id, to]));
  return conversations.map((conversation) => {
    const to = handedTo.get(conversation.id);
    if (to !== undefined) return { ...conversation, status: "Assigned" as const, assignee: to };
    return answered.has(conversation.id) ? { ...conversation, status: "Handled" as const, assignee: "" } : conversation;
  });
}

/**
 * The conversations the toolbar leaves showing. Search matches the person,
 * their handle, what they wrote, or the account cell as the page shows it; the
 * three selects and the age threshold each narrow one property. An empty value
 * is "any", as each select's first option is.
 */
export function filterConversations(conversations: readonly Conversation[], filters: InboxFilters): Conversation[] {
  const needle = filters.search.trim().toLowerCase();
  const kind = labelFor(INBOX_KIND_OPTIONS, filters.kind);
  const status = labelFor(INBOX_STATUS_OPTIONS, filters.status);
  return conversations.filter((conversation) => {
    const account = inboxAccountById(conversation.accountId);
    const matchesSearch = needle === ""
      || conversation.author.name.toLowerCase().includes(needle)
      || conversation.author.handle.toLowerCase().includes(needle)
      || conversation.message.toLowerCase().includes(needle)
      || inboxAccountCellText(account).toLowerCase().includes(needle);
    return matchesSearch
      && (filters.account === "" || account.slug === filters.account)
      && (kind === undefined || conversation.kind === kind)
      && (status === undefined || conversation.status === status)
      && olderThan(conversation, filters.age);
  });
}

/**
 * The conversations shown once `page` pages have been loaded, and whether
 * pressing the control again would bring more. Loading older conversations
 * adds to what is on screen rather than replacing it, which is what the
 * control says it does and what lets a read take each conversation once.
 */
export function pageOf(matched: readonly Conversation[], page: number): { items: Conversation[]; more: boolean; shown: number } {
  const whole = Number.isSafeInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
  const start = (whole - 1) * INBOX_PAGE_SIZE;
  return { items: matched.slice(start, start + INBOX_PAGE_SIZE), more: whole * INBOX_PAGE_SIZE < matched.length, shown: Math.min(whole * INBOX_PAGE_SIZE, matched.length) };
}

/** What the page header counts: everything watched, what nobody has answered, and what is with a teammate. */
export function inboxCounts(conversations: readonly Conversation[]): { conversationCount: number; unansweredCount: number; assignedCount: number } {
  return {
    conversationCount: conversations.length,
    unansweredCount: conversations.filter((conversation) => conversation.status === "Unanswered").length,
    assignedCount: conversations.filter((conversation) => conversation.status === "Assigned").length,
  };
}

/** The header stat line, which is also the oracle a final-state fact reads. */
export function inboxStatsText(conversations: readonly Conversation[]): string {
  const { conversationCount, unansweredCount, assignedCount } = inboxCounts(conversations);
  return `${conversationCount} conversations · ${unansweredCount} unanswered · ${assignedCount} assigned`;
}

export function inboxStatusText(shown: number, matched: number): string {
  return `Showing ${shown} of ${matched} conversations`;
}

/** Coerces untrusted filter input from the `items` route's query into the five things the toolbar can ask for. */
export function normalizeInboxFilters(query: URLSearchParams): InboxFilters {
  const read = (name: string) => (query.get(name) ?? "").trim().slice(0, 80);
  return { search: read("q"), account: read("account"), kind: read("kind"), status: read("status"), age: read("age") };
}

/** Whether a conversation is old enough for a named age threshold. An age the select does not offer is "any age". */
function olderThan(conversation: Conversation, age: string): boolean {
  if (age === "today") return conversation.ageMinutes <= MINUTES_PER_DAY;
  if (age === "over-1d") return conversation.ageMinutes > MINUTES_PER_DAY;
  if (age === "over-3d") return conversation.ageMinutes > 3 * MINUTES_PER_DAY;
  if (age === "over-1w") return conversation.ageMinutes > MINUTES_PER_WEEK;
  return true;
}

/** The label of a chosen option, or `undefined` for "any" and for a value no option offers. */
function labelFor(options: readonly InboxOption[], value: string): string | undefined {
  if (value === "") return undefined;
  return options.find((option) => option.value === value)?.label;
}
