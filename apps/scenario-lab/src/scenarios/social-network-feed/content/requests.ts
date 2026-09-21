/**
 * One friend request, as its card shows it. `mutualLine` is the card's own
 * words, and the site writes it three ways -- "23 mutual friends", "Aisha Khan
 * and 4 other mutual friends", or nothing at all -- so `mutualCount` is the
 * number a person works out from it.
 */
export type FriendRequest = { id: string; person: string; mutualLine?: string; mutualCount: number; sent: string };

/**
 * Maya's friend requests, in the order the page lists them.
 *
 * Four of the eight have five or more mutual friends, and each of the four
 * says so differently: 23, "Aisha Khan and 4 other" (five), 11, and exactly
 * five. Priya Nair has four, one short. The first card is a second Tom Becker,
 * whose one mutual friend is the other Tom Becker.
 *
 * The Friends home shows only the first four, and the top bar's badge says 4,
 * which it has said since before the last four arrived.
 */
export const FRIEND_REQUESTS: readonly FriendRequest[] = [
  { id: "rq_52e0a1", person: "tom.becker.9", mutualLine: "1 mutual friend", mutualCount: 1, sent: "2w" },
  { id: "rq_8b41c7", person: "amara-osei", mutualLine: "23 mutual friends", mutualCount: 23, sent: "3d" },
  { id: "rq_19f3d2", person: "priya-nair", mutualLine: "4 mutual friends", mutualCount: 4, sent: "5d" },
  { id: "rq_c7a0e5", person: "jonas-weber", mutualLine: "Aisha Khan and 4 other mutual friends", mutualCount: 5, sent: "1w" },
  { id: "rq_3d6b28", person: "diego-alvarez", mutualCount: 0, sent: "1w" },
  { id: "rq_e24f90", person: "lin-zhao", mutualLine: "11 mutual friends", mutualCount: 11, sent: "2w" },
  { id: "rq_7a95b3", person: "freya-holm", mutualLine: "5 mutual friends", mutualCount: 5, sent: "3w" },
  { id: "rq_b0c8f4", person: "marta-kowalczyk", mutualLine: "3 mutual friends", mutualCount: 3, sent: "4w" },
];

/** What the stale badge on the top bar's Friends icon says, whatever the list holds. */
export const STALE_REQUEST_BADGE = "4";

/** How many requests the Friends home lists before "See all". */
export const REQUESTS_ON_FRIENDS_HOME = 4;

/** People the site suggests, each with an Add friend button. One of them is a second Jonas Weber. */
export const PEOPLE_YOU_MAY_KNOW: ReadonlyArray<{ person: string; mutualLine: string }> = [
  { person: "rosa-delgado", mutualLine: "2 mutual friends" },
  { person: "jonas.weber.hb", mutualLine: "Grace Liu is a mutual friend" },
  { person: "idris-bello", mutualLine: "6 mutual friends" },
  { person: "noah-fischer", mutualLine: "1 mutual friend" },
  { person: "chloe-martin", mutualLine: "9 mutual friends" },
  { person: "sam-okoro", mutualLine: "3 mutual friends" },
];

/**
 * The site's rate limit on confirming requests: at most this many in any
 * window of this length. A person working down the list at an ordinary pace
 * meets it once, waits out the countdown, and carries on; a script that fires
 * every Confirm in a burst has the fourth one refused.
 */
export const CONFIRM_RATE_LIMIT = { max: 3, windowMs: 15_000 } as const;

export function friendRequestById(id: string): FriendRequest | undefined {
  return FRIEND_REQUESTS.find((request) => request.id === id);
}
