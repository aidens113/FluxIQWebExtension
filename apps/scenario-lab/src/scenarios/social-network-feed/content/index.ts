/**
 * Everything the site says, authored once: its people and communities, its
 * clock, the feed, the group discussion and the friend requests. The pages,
 * the manifest and the tests all read from here, so what the page shows and
 * what an expectation says it shows cannot drift apart.
 */
export { fullDateText, REFERENCE_NOW_MS, shortDateText } from "./clock.js";
export { RIVERSIDE_DISCUSSION, TASK_GROUP } from "./discussion.js";
export { COMMUNITIES, communityBySlug, MAYA, PEOPLE, personBySlug } from "./people.js";
export type { Community, Person } from "./people.js";
export { BATCH_SIZE, createdPostUnit, feedPlanFor, findPost } from "./plan.js";
export type { FeedEntry, FeedPlan } from "./plan.js";
export { CONFIRM_RATE_LIMIT, friendRequestById, FRIEND_REQUESTS, PEOPLE_YOU_MAY_KNOW, REQUESTS_ON_FRIENDS_HOME, STALE_REQUEST_BADGE } from "./requests.js";
export type { FriendRequest } from "./requests.js";
export { FEED_AFTER_CAUGHT_UP, FEED_BEFORE_CAUGHT_UP, OPEN_DAY_POST, QUIET_FEED_UNITS } from "./units.js";
export type { Attachment, CarouselUnit, FeedPost, FeedUnit, MemoryUnit, RecapUnit, SharedUnit, SponsoredUnit, SuggestedUnit } from "./units.js";
