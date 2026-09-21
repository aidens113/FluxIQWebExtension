import { defineScenario } from "../../types.js";
import { socialNetworkFeedManifest } from "./manifest.js";
import { renderHomePage } from "./markup/index.js";
import { routeFeed } from "./route.js";
import { createFeedState, mutateFeedState } from "./state.js";
import type { FeedState } from "./types.js";

/**
 * A social network the size and shape of the real ones: Circleway, a
 * fictional brand, signed in as Maya Lindqvist.
 *
 * Its home feed loads in batches as it is scrolled, behind skeleton cards,
 * with friends' posts, group posts, adverts whose "Sponsored" label is not
 * text, suggestions, friends sharing pages' posts, carousels, a memory, and
 * posts shown a second time because friends commented on them. Long posts are
 * cut short behind "See more". A cookie dialog owns the page on arrival; a
 * notification prompt follows it; a chat window then pops open over the
 * bottom right of the screen. Class names are hashed per lab seed, element ids
 * are generated as things mount, and most controls are `div`s with a role.
 *
 * Around the feed: a group whose composer is a content-editable box with a
 * hidden trap field and a Post button that swallows its first press, and
 * whose posts wait for an admin; a friend-requests page whose badge is stale,
 * whose mutual-friend counts are written three different ways, and which
 * refuses Confirm when it is pressed too fast; and Maya's own boosted post,
 * which the site will not let her edit.
 *
 * The content is authored and the clock is fixed, so every seed shows the same
 * words; the seed moves only the class names and the tracking tokens.
 */
export const socialNetworkFeedScenario = defineScenario<FeedState>({
  id: "social-network-feed",
  title: "Social network feed",
  startPath: "/scenarios/social-network-feed/",
  seed: 5101,
  manifest: socialNetworkFeedManifest,
  createState: () => createFeedState(),
  mutate: mutateFeedState,
  render: renderHomePage,
  route: routeFeed,
});
