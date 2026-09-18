import { connectedAccounts } from "./accounts.js";
import { postStatuses } from "./types.js";

/** One option of a toolbar select: the value the control carries, and the label a person reads. */
export type QueueOption = { value: string; label: string };

/**
 * The Account select. Its label spells the account out in full -- display
 * name, network, handle -- because two accounts share a display name and the
 * name alone would offer the same option twice.
 */
export const ACCOUNT_OPTIONS: readonly QueueOption[] = [
  { value: "", label: "All accounts" },
  ...connectedAccounts.map((account) => ({ value: account.slug, label: `${account.display} · ${account.network} · ${account.handle}` })),
];

/** The Status select. Its values are the badge text lowercased, which is also what the filter compares against. */
export const STATUS_OPTIONS: readonly QueueOption[] = [
  { value: "", label: "Any status" },
  ...postStatuses.map((status) => ({ value: status.toLowerCase(), label: status })),
];

/**
 * The date-range select, in the words a publishing tool uses. The ranges are
 * measured against the console's fixed reference time, never the wall clock.
 */
export const RANGE_OPTIONS: readonly QueueOption[] = [
  { value: "", label: "Any time" },
  { value: "next-7", label: "Next 7 days" },
  { value: "upcoming", label: "Everything upcoming" },
  { value: "last-7", label: "Last 7 days" },
  { value: "past", label: "Already gone out" },
];
