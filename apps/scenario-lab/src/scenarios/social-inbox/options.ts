import { inboxAccountOptionLabel, inboxAccounts } from "./accounts.js";
import { conversationKinds, conversationStatuses } from "./types.js";

/** One option of a toolbar select: the value the control carries, and the label a person reads. */
export type InboxOption = { value: string; label: string };

/**
 * The Account select. Its label names the network, because three of the six
 * accounts share both a display name and a handle and would otherwise offer
 * the same option three times.
 */
export const INBOX_ACCOUNT_OPTIONS: readonly InboxOption[] = [
  { value: "", label: "All accounts" },
  ...inboxAccounts.map((account) => ({ value: account.slug, label: inboxAccountOptionLabel(account) })),
];

/** The Kind select: mentions, comments and direct messages, as the Kind column spells them. */
export const INBOX_KIND_OPTIONS: readonly InboxOption[] = [
  { value: "", label: "Any kind" },
  ...conversationKinds.map((kind) => ({ value: kind.toLowerCase().replaceAll(" ", "-"), label: kind })),
];

/** The Status select. "Unanswered" is a conversation nobody has replied to, marked handled, or handed on. */
export const INBOX_STATUS_OPTIONS: readonly InboxOption[] = [
  { value: "", label: "Any status" },
  ...conversationStatuses.map((status) => ({ value: status.toLowerCase(), label: status })),
];

/**
 * The Age select, in the words an inbox uses. The thresholds are measured
 * against the inbox's fixed reference time, never the wall clock.
 */
export const INBOX_AGE_OPTIONS: readonly InboxOption[] = [
  { value: "", label: "Any age" },
  { value: "today", label: "Last 24 hours" },
  { value: "over-1d", label: "Older than a day" },
  { value: "over-3d", label: "Older than 3 days" },
  { value: "over-1w", label: "Older than a week" },
];
