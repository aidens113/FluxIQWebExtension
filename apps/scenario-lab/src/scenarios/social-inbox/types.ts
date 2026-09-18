/**
 * The inbox's vocabulary: the account a conversation arrived on, the person it
 * came from, what kind of message it is, and the renderings the fixture can be
 * armed into.
 *
 * `baseline` is the inbox as it ships. The three armed renderings are each one
 * thing a real deployment does between a recording and a run:
 *
 * - `restyled` -- the CSS-in-JS build hash moved, so every generated class
 *   name on the page is different and nothing else is.
 * - `moved-send` -- the reply dialog was redesigned: Send moved out of the
 *   footer into the dialog's header and lost its test id, and Discard now
 *   stands where the recorded control was. Only a repair that re-points the
 *   click at Send, rather than at the control in the old place, passes it.
 * - `quiet-inbox` -- a quieter week: most of the old backlog has been dealt
 *   with, so the same "what is still unanswered" job has a smaller answer.
 */
export const inboxModes = ["baseline", "restyled", "moved-send", "quiet-inbox"] as const;

export type InboxMode = (typeof inboxModes)[number];

/** What a conversation is waiting for, as the badge spells it. */
export const conversationStatuses = ["Unanswered", "Handled", "Assigned"] as const;

export type ConversationStatus = (typeof conversationStatuses)[number];

/** The kinds of message the inbox collects, as the Kind column spells them. */
export const conversationKinds = ["Mention", "Comment", "Direct message"] as const;

export type ConversationKind = (typeof conversationKinds)[number];

/**
 * One connected account. Three of these share both a display name and a
 * handle, and differ only by the network they post on.
 */
export type InboxAccount = {
  id: string;
  handle: string;
  network: string;
  display: string;
  /** The toolbar select's option value for this account. */
  slug: string;
};

/** The person a conversation came from. Authors repeat: one person writes three or four times. */
export type Correspondent = { name: string; handle: string; initials: string };

/** One row of the inbox. `ageMinutes` is measured from the inbox's fixed reference time. */
export type Conversation = {
  id: string;
  author: Correspondent;
  accountId: string;
  kind: ConversationKind;
  /** What they said in full; the row shows a truncated excerpt of it. */
  message: string;
  status: ConversationStatus;
  /** Who is dealing with it, or an empty string when nobody is. */
  assignee: string;
  ageMinutes: number;
};

/** What the toolbar is asking for. Empty strings are "any", as the selects' first options are. */
export type InboxFilters = { search: string; account: string; kind: string; status: string; age: string };

/** A reply the run sent: which conversation, and what it said. */
export type SentReply = { id: string; text: string };

/**
 * What the run left behind. `replies`, `handled` and `assigned` are the changes
 * the page reported through `mutate`; `oracle` is the inbox those changes
 * produce, so a run's final state can be checked without replaying the page's
 * arithmetic.
 */
export type InboxState = {
  mode: InboxMode;
  replies: SentReply[];
  /** Ids marked handled without a reply, oldest first. */
  handled: string[];
  /** Ids handed to a teammate, with the teammate's name. */
  assigned: Array<{ id: string; to: string }>;
  /** Ids of conversation pages opened through the `route` hook, oldest first, capped. */
  opened: string[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
  oracle: { conversationCount: number; unansweredCount: number; assignedCount: number };
};
