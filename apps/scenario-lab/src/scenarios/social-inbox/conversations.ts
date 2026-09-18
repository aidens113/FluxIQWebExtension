import { inboxAccounts } from "./accounts.js";
import type { Conversation, ConversationKind, ConversationStatus, Correspondent, InboxMode } from "./types.js";

/** How many conversations the inbox holds. Large enough that one screen is nowhere near all of it. */
export const INBOX_SIZE = 320;
/** How many the inbox shows at a time. Everything older comes from pressing the control at the bottom. */
export const INBOX_PAGE_SIZE = 25;

/** The inbox's fixed "now": Monday 21 September 2026, 09:00 UTC. Every age is measured from here, never from the wall clock. */
export const REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 9, 0);

/** The people conversations get handed to, in the order the assignment menu offers them. */
export const INBOX_TEAM = ["Dara Ogun", "Mikko Salo", "Beth Arden", "Noor Haddad", "Tom Vickers"] as const;

/** A week in minutes: the line `quiet-inbox` clears behind, and the point where an age is written in weeks. */
const MINUTES_PER_WEEK = 10_080;

const GIVEN_NAMES = [
  "Amara", "Bruno", "Clara", "Desmond", "Elena", "Felix", "Greta", "Hugo", "Ingrid", "Joon",
  "Kasia", "Leila", "Marcus", "Naomi", "Otto", "Priya", "Rafael", "Sofia", "Tomas", "Yusuf",
] as const;
const FAMILY_NAMES = ["Achebe", "Barros", "Castellano", "Duval", "Ferris", "Hollis", "Krause", "Lindqvist"] as const;

/**
 * Eighty-three correspondents for 320 conversations, so each person writes
 * three or four times. Eighty-three is prime, and coprime with the account,
 * kind and status cycles, so one person's conversations land on different
 * accounts, in different kinds and in different states -- which is what makes
 * "reply to this person's mention" a question rather than a lookup.
 */
const CORRESPONDENT_COUNT = 83;

/** The kinds, in a five-long cycle so that most of the inbox is comments and mentions. */
const KIND_CYCLE: readonly ConversationKind[] = ["Mention", "Comment", "Comment", "Direct message", "Mention"];

/** What people actually write to a coffee roaster. Twenty-two lines over 320 rows, so a message names no single row. */
const MESSAGES = [
  "Is the Harbour Blend still decaf-friendly? My partner cannot do caffeine after two and I would love to send a bag.",
  "Just had the flat white at the Quay Street shop and it was the best I have had all year. Whoever was on bar, thank you.",
  "My order says delivered but nothing has arrived. Number is HP-40192 if that helps.",
  "Do you ship to the islands? The checkout will not take my postcode.",
  "Any chance of the seasonal roast coming back? I have been rationing the last bag since August.",
  "The grinder you recommended has been brilliant, six months in and no complaints at all.",
  "Second time the subscription has charged twice in a month. Could someone take a look?",
  "Are the tins recyclable locally or do they need to go back to you?",
  "Booked the cupping session for Saturday and cannot wait. Is there parking behind the roastery?",
  "Your barista talked me through the pour-over for twenty minutes and did not once make me feel daft. Rare.",
  "The bag arrived split and half of it was in the box. Photo attached.",
  "Could you do a wholesale price for a twelve-cup office? We get through about two kilos a week.",
  "Whoever wrote the note in my parcel, thank you, it made my week.",
  "Is the cafe dog friendly on the terrace or only inside the courtyard?",
  "I keep getting the newsletter twice and unsubscribing takes one of them off, then both come back.",
  "Do you still do the repair-and-refill for the travel cups or has that stopped?",
  "The espresso was pulled far too short this morning and nobody wanted to know when I asked.",
  "Any plans for a decaf single origin? The blend is good but I miss having a choice.",
  "Loved the roastery tour. Tell whoever runs it that the bit about altitude was the best part.",
  "Gift subscription for my dad arrived a week late and the card was missing.",
  "Can I change the grind on an existing subscription without cancelling and starting again?",
  "Been buying from you since the market stall days. Still the best in the county.",
] as const;

/**
 * The whole inbox under a rendering, newest first, which is the order an inbox
 * is read in. Ages grow faster than linearly, as a real inbox does: busy in
 * the last day, sparse at the back.
 *
 * Only `quiet-inbox` changes anything: everything older than a week that was
 * still unanswered has since been dealt with, so the same backlog job has a
 * smaller answer. The lab seed reaches none of it.
 */
export function conversationsFor(mode: InboxMode): readonly Conversation[] {
  return Array.from({ length: INBOX_SIZE }, (_unused, index) => conversation(index, mode));
}

export function conversationById(mode: InboxMode, id: string): Conversation | undefined {
  return conversationsFor(mode).find((candidate) => candidate.id === id);
}

/**
 * The conversation the recorded reply workflow answers: an unanswered mention
 * from someone who mentioned the workspace exactly once but wrote three or
 * four times in all, far enough down the inbox that it is not on the first
 * screen. Searching their name and narrowing to mentions is the only way to
 * be left with it alone, which is the job the fixture exists to pose.
 */
export const REPLY_TARGET: Conversation = findReplyTarget();

function conversation(index: number, mode: InboxMode): Conversation {
  const ageMinutes = 25 + index * 31 + Math.round(index * index * 0.9);
  const baseStatus = statusOf(index);
  const cleared = mode === "quiet-inbox" && ageMinutes > MINUTES_PER_WEEK && baseStatus === "Unanswered";
  const status = cleared ? "Handled" : baseStatus;
  return {
    id: `cnv_${identifier(index)}`,
    author: correspondent(index % CORRESPONDENT_COUNT),
    accountId: cycle(inboxAccounts, index).id,
    kind: cycle(KIND_CYCLE, index),
    message: cycle(MESSAGES, index),
    status,
    assignee: status === "Assigned" ? cycle(INBOX_TEAM, index) : "",
    ageMinutes,
  };
}

/**
 * Roughly a third of the inbox has been dealt with and a twentieth is with a
 * teammate. Eleven and thirteen are coprime with the account cycle (six) and
 * the kind cycle (five) on purpose: with a shared factor, whole accounts and
 * whole kinds come out entirely handled, which no real inbox does and which
 * would quietly empty the backlog job for two of the six accounts.
 */
function statusOf(index: number): ConversationStatus {
  if (index % 11 < 4) return "Handled";
  return index % 13 === 2 ? "Assigned" : "Unanswered";
}

function correspondent(index: number): Correspondent {
  const given = cycle(GIVEN_NAMES, index);
  const family = FAMILY_NAMES[Math.floor(index / GIVEN_NAMES.length) % FAMILY_NAMES.length] ?? "Achebe";
  return {
    name: `${given} ${family}`,
    handle: `@${given.toLowerCase()}.${family.toLowerCase()}`,
    initials: `${given.slice(0, 1)}${family.slice(0, 1)}`,
  };
}

function findReplyTarget(): Conversation {
  const all = conversationsFor("baseline");
  const mentions = new Map<string, number>();
  const written = new Map<string, number>();
  for (const entry of all) {
    written.set(entry.author.handle, (written.get(entry.author.handle) ?? 0) + 1);
    if (entry.kind === "Mention") mentions.set(entry.author.handle, (mentions.get(entry.author.handle) ?? 0) + 1);
  }
  const found = all.find((entry, index) => index >= INBOX_PAGE_SIZE
    && entry.kind === "Mention"
    && entry.status === "Unanswered"
    && entry.ageMinutes <= MINUTES_PER_WEEK
    && mentions.get(entry.author.handle) === 1
    && (written.get(entry.author.handle) ?? 0) >= 3);
  if (!found) throw new Error("The inbox holds no conversation the reply workflow could be recorded against");
  return found;
}

/**
 * An opaque six-hex conversation id, as a real inbox shows rather than a row
 * number. Knuth's multiplicative constant is odd, so the low 24 bits are a
 * bijection and no two conversations can collide.
 */
function identifier(index: number): string {
  return (((index + 41) * 2_654_435_761) % 16_777_216).toString(16).padStart(6, "0");
}

function cycle<TValue>(values: readonly TValue[], index: number): TValue {
  const value = values[index % values.length];
  if (value === undefined) throw new Error("An inbox cycle must not be empty");
  return value;
}
