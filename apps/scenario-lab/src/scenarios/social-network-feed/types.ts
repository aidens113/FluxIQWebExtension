/**
 * The social network's vocabulary: the renderings it can be armed into, what a
 * run can leave behind, and the shapes the authored content takes.
 *
 * `baseline` is the site as it ships. Each armed rendering is one thing that
 * happens to a real social network between a Flow being made and being run:
 *
 * - `regrouped` -- a group-page redesign. The "Write something..." prompt the
 *   recording pressed is gone, and a row of Create post, Create poll and
 *   Create event buttons stands where it was. Create poll opens the same
 *   dialog in poll mode, so a repair that re-points the press at the wrong
 *   one of the three posts the text as a poll question.
 * - `quiet-feed` -- a quieter few days: the feed reaches "You're all caught
 *   up" after fifteen units instead of thirty, so the same digest job has a
 *   smaller correct answer.
 * - `app-install` -- the site opens on a full-page "Circleway is better in the
 *   app" interstitial until the visitor chooses to continue in the browser.
 *   Behind it the feed is the baseline one.
 */
export const feedModes = ["baseline", "regrouped", "quiet-feed", "app-install"] as const;

export type FeedMode = (typeof feedModes)[number];

/** Who a post is shared with, as the audience icon's label names it. */
export type Audience = "Public" | "Friends" | "Only me" | "Members";

/** A post the run created through a composer, in the order the server accepted it. */
export type CreatedPost = { id: string; text: string; audience: Audience };

/** A group post or poll the run submitted and the server put in front of the group's admins. */
export type PendingGroupPost = { group: string; kind: "post" | "poll"; text: string };

/**
 * What the run left behind. Every field is something the page reported
 * through `mutate`, so a run's final state can be read back without replaying
 * the page. Arming a rendering clears all of it, so an armed run's state is
 * its own and never a stale success from the build that explored first.
 *
 * - `consent`, `notificationsPrompt`, `chat` and `appPromo` are the overlays'
 *   answers. The site remembers them for the signed-in account, which is why a
 *   reload does not bring an answered overlay back.
 * - `pending` holds the group posts the admins now have to approve; `spam`
 *   counts submissions the server dropped because the form's hidden trap field
 *   came back filled, which the page never tells anyone about.
 * - `requests` maps a friend request's id to what happened to it;
 *   `rateLimited` counts presses the site refused for going too fast.
 */
export type FeedState = {
  mode: FeedMode;
  consent: "pending" | "all" | "essential";
  notificationsPrompt: "pending" | "dismissed" | "allowed";
  chat: "unopened" | "open" | "closed";
  appPromo: "pending" | "dismissed";
  pending: PendingGroupPost[];
  spam: number;
  created: CreatedPost[];
  trashed: string[];
  hidden: string[];
  liked: string[];
  /** Posts the run published again to Maya's own profile with "Share now". */
  shared: string[];
  requests: Record<string, "confirmed" | "deleted">;
  friendRequestsSent: string[];
  chatMessagesSent: number;
  rateLimited: number;
  activity: string[];
};
