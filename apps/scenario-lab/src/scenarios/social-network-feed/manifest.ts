import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { communityBySlug, feedPlanFor, FRIEND_REQUESTS, fullDateText, MAYA, OPEN_DAY_POST, personBySlug, type FeedPost } from "./content/index.js";
import { buildMarkerText, cutText, pendingBoxText } from "./markup/index.js";
import type { FeedMode } from "./types.js";

const ROOT = "/scenarios/social-network-feed/";

/** What the group-post task asks Maya's group to see, word for word. */
export const GROUP_POST_TEXT = "Spare rhubarb crowns at plot 14, free to anyone who can collect them this weekend. Bring a bag!";

/** The open-day post as it has to read once the day has moved. */
export const MOVED_OPEN_DAY_TEXT = OPEN_DAY_POST.text.replace("Saturday 26 September", "Sunday 27 September");

/**
 * The same three overlays open every visit to a fresh account, in order: the
 * cookie dialog, then three seconds after it is answered the notification
 * prompt, then two and a half seconds after that a chat window over the
 * bottom right. The honest path answers each, as a person does, before it
 * does anything else.
 */
const OVERLAYS: ScenarioStep[] = [
  { id: "allow-cookies", operation: "click", target: "role:button:Allow all cookies" },
  { id: "notifications-asked", operation: "waitForState", target: "role:dialog:Turn on notifications?", timeoutMs: 8000 },
  { id: "not-now", operation: "click", target: "role:button:Not now" },
  { id: "chat-popped", operation: "waitForState", target: "role:dialog:Chat with Elena Sokolova", timeoutMs: 8000 },
  { id: "close-chat", operation: "click", target: "role:button:Close chat" },
];

/** The Post button swallows its first press, so the honest path presses, waits for it to stop spinning, and presses again. */
const PRESS_POST_TWICE: ScenarioStep[] = [
  { id: "press-post", operation: "click", target: "role:button:Post" },
  { id: "post-ready-again", operation: "waitForState", target: "[aria-label=\"Post\"]:not([aria-busy])", timeoutMs: 3000 },
  { id: "press-post-again", operation: "click", target: "role:button:Post" },
];

/**
 * The feed digest's fields, as structure rather than classes, because the
 * classes change with every build. The author is the first profile link that
 * is not an avatar -- which in a group post is the second line, under the
 * group's name. The date is the timestamp link's label. The reactions are the
 * text after the reaction icons, and the comments the count that expands the
 * comment list.
 */
const DIGEST_FIELDS = {
  author: "a[href*=\"/people/\"]:not([aria-hidden])",
  group: "h3 a[href*=\"/groups/\"]",
  posted: "a[href*=\"/posts/\"][aria-label]@aria-label",
  text: "[data-ad-comet-preview=\"message\"]",
  reactions: "[aria-label=\"See who reacted to this\"] + span",
  comments: "[role=\"button\"][aria-expanded] > span",
};

const OWN_POST = "[role=\"feed\"] > [role=\"article\"]:has(h3 a[href*=\"/people/maya-lindqvist/\"])";
const CONFIRMED_CARD = "[role=\"list\"] > [role=\"listitem\"]:has(a[href*=\"/messages/t/\"])";
const card = (slug: string) => `[role="listitem"]:has(a[href$="/people/${slug}/"])`;

const QUALIFYING = FRIEND_REQUESTS.filter((request) => request.mutualCount >= 5);

const path = (value: string): ExpectedFact => ({ id: "document-path", subject: "document", predicate: "path", value });
const buildIs = (mode: FeedMode): ExpectedFact => ({ id: "build-marker", subject: "build-marker", predicate: "text", value: buildMarkerText(mode) });
const PENDING: ExpectedFact = { id: "pending-post", subject: "pending-posts", predicate: "text", value: pendingBoxText([{ kind: "post", text: GROUP_POST_TEXT }]) };

/**
 * Circleway's manifest. Four jobs, each of the kind people really automate on
 * a social network, and each one judged by something only doing it properly
 * produces:
 *
 * - the primary workflow posts in a group, judged by the group's pending box,
 *   which the server fills only with what it kept;
 * - `feed-digest` reads a friends-only digest of the home feed, judged record
 *   by record;
 * - `confirm-requests` confirms the friend requests that qualify, past a rate
 *   limit, and reads back who was confirmed;
 * - `move-open-day` changes a boosted post the site will not let anyone edit,
 *   which can only be done by deleting it and posting again.
 *
 * `recordingEvents` names types without counts: no recording lane has run this
 * fixture, so only "this type occurred" can be claimed honestly.
 */
export const socialNetworkFeedManifest = createScenarioManifest({
  id: "social-network-feed",
  title: "Social network feed",
  tags: ["social", "feed", "infinite-scroll", "sponsored", "consent", "overlays", "generated-classes", "honeypot", "rate-limit", "iframe", "extraction", "permission"],
  seed: 5101,
  startPath: ROOT,
  capabilities: ["navigation", "forms", "scroll", "mutation", "iframe", "popup"],
  recordingScript: [
    ...OVERLAYS,
    { id: "open-group", operation: "click", target: "nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/riverside-allotments/\"]" },
    { id: "group-open", operation: "waitForState", target: "testid:group-composer-prompt", timeoutMs: 5000 },
    { id: "open-composer", operation: "click", target: "testid:group-composer-prompt" },
    { id: "composer-open", operation: "waitForState", target: "role:dialog:Create post", timeoutMs: 3000 },
    { id: "write-post", operation: "type", target: "role:textbox:Write something...", value: GROUP_POST_TEXT },
    ...PRESS_POST_TWICE,
    { id: "post-pending", operation: "waitForState", target: "testid:pending-posts", timeoutMs: 5000 },
    { id: "posted", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "post-in-group",
    description: "Post the rhubarb notice in the Riverside Allotment Society group, word for word, and leave it waiting for the admins' approval.",
    successFacts: [{ ...PENDING }],
  },
  expected: {
    pageFacts: [buildIs("baseline"), path(ROOT)],
    recordingEvents: [{ type: "web.element.clicked" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
    finalState: [{ ...PENDING }],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "regrouped",
    description: "Only a repair can pass this row. A group-page redesign took the Write something... prompt away -- the one control the recording pressed by its test id -- and put Create post, Create poll and Create event where it stood. A provider-free run fails with target_not_found. The expectations are the repaired run's: re-pointed at Create post, the same dialog opens and the post goes to the admins; re-pointed at Create poll, the text becomes a poll question and the pending box says Poll.",
    arm: { operation: "set-mode", payload: { mode: "regrouped" } },
    expected: {
      pageFacts: [buildIs("regrouped"), { id: "recorded-prompt-gone", subject: "group-composer-prompt", predicate: "exists", value: false }, path(ROOT)],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
      finalState: [{ ...PENDING }],
    },
  }],
  workflows: [
    {
      id: "feed-digest",
      description: "Read the home feed down to You're all caught up and keep only what friends wrote themselves -- no adverts, suggestions, shares, own posts, memories or repeats -- with every long post read whole.",
      recordingScript: [
        ...OVERLAYS,
        ...Array.from({ length: 14 }, (_unused, index): ScenarioStep => ({ id: `scroll-${index + 1}`, operation: "scroll", value: 6000 })),
        { id: "caught-up", operation: "waitForState", target: "role:heading:You're all caught up", timeoutMs: 10000 },
        ...digestPositions("baseline").filter(({ post }) => cutText(post.text) !== undefined).map(({ position }): ScenarioStep => ({
          id: `see-more-${position}`, operation: "click", target: `[role="feed"] > [aria-posinset="${position}"] [data-ad-comet-preview="message"] [role="button"]`,
        })),
        { id: "extract-feed-digest", operation: "extract", target: digestPositions("baseline").map(({ position }) => `[role="feed"] > [aria-posinset="${position}"]`).join(", "), fields: DIGEST_FIELDS },
        { id: "digest-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [buildIs("baseline"), path(ROOT)],
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [digest("baseline")],
        finalState: [path(ROOT)],
        allowedConsoleErrors: [],
      },
      variants: [
        {
          id: "quiet-feed",
          description: "A quieter few days: the feed is caught up after fifteen units, so the same digest is seven posts long. A run that returns the sixteen of a busy week has read somebody else's week, and a recorded Flow that waits for the thirtieth unit waits for a unit that never comes.",
          arm: { operation: "set-mode", payload: { mode: "quiet-feed" } },
          expected: { pageFacts: [buildIs("quiet-feed"), path(ROOT)], extracted: [digest("quiet-feed")] },
        },
        {
          id: "app-install",
          description: "The site opens on a full-page Circleway is better in the app interstitial. Its big button leads to an app store; the way on is a small grey Continue in browser line that is not a link or a button. Once past it, the feed and the digest are the baseline ones.",
          arm: { operation: "set-mode", payload: { mode: "app-install" } },
          expected: {
            pageFacts: [{ id: "app-promo-showing", subject: "app-promo", predicate: "visible", value: true }, path(ROOT)],
            extracted: [digest("app-install")],
          },
        },
      ],
    },
    {
      id: "confirm-requests",
      description: "Confirm every friend request from someone with at least five mutual friends -- counted from three ways of writing it -- past a stale badge, a four-card preview and a rate limit, then read back who was confirmed.",
      recordingScript: [
        ...OVERLAYS,
        { id: "open-friends", operation: "click", target: "[role=\"banner\"] a[aria-label=\"Friends\"]" },
        { id: "friends-open", operation: "waitForState", target: "[role=\"main\"] a[href$=\"/friends/requests/\"]", timeoutMs: 5000 },
        { id: "see-all-requests", operation: "click", target: "[role=\"main\"] a[href$=\"/friends/requests/\"]" },
        { id: "requests-open", operation: "waitForState", target: card("marta-kowalczyk"), timeoutMs: 5000 },
        ...QUALIFYING.slice(0, 3).flatMap((request): ScenarioStep[] => [
          { id: `confirm-${request.person}`, operation: "click", target: `${card(request.person)} [aria-label="Confirm"]` },
          { id: `accepted-${request.person}`, operation: "waitForState", target: `${card(request.person)} a[href*="/messages/t/"]`, timeoutMs: 3000 },
        ]),
        ...QUALIFYING.slice(3).flatMap((request): ScenarioStep[] => [
          { id: `confirm-${request.person}`, operation: "click", target: `${card(request.person)} [aria-label="Confirm"]` },
          { id: `too-fast-${request.person}`, operation: "waitForState", target: "role:alertdialog:You're going too fast", timeoutMs: 3000 },
          { id: `retry-offered-${request.person}`, operation: "waitForState", target: "role:button:Try again", timeoutMs: 17000 },
          { id: `retry-${request.person}`, operation: "click", target: "role:button:Try again" },
          { id: `accepted-${request.person}`, operation: "waitForState", target: `${card(request.person)} a[href*="/messages/t/"]`, timeoutMs: 3000 },
        ]),
        { id: "extract-confirmed", operation: "extract", target: CONFIRMED_CARD, fields: { name: "a[href*=\"/people/\"]:not([aria-hidden])", mutualFriends: "a[href*=\"/people/\"]:not([aria-hidden]) + div" } },
        { id: "confirmed-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [buildIs("baseline"), path(ROOT)],
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{
          step: "extract-confirmed",
          count: QUALIFYING.length,
          records: QUALIFYING.map((request) => ({ name: personBySlug(request.person).name, mutualFriends: request.mutualLine ?? null })),
        }],
        finalState: [path(`${ROOT}friends/requests/`)],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "move-open-day",
      description: "Move Maya's boosted open-day post from Saturday to Sunday. The site refuses to edit or archive a boosted post, so the only way is to move it to the trash -- a deletion -- and post it again to the same Public audience. A build without permission to delete should stop and ask; the expectations are the permitted run's.",
      recordingScript: [
        ...OVERLAYS,
        { id: "own-post-loaded", operation: "waitForState", target: `${OWN_POST} [aria-label="Actions for this post"]`, timeoutMs: 5000 },
        { id: "open-post-menu", operation: "click", target: `${OWN_POST} [aria-label="Actions for this post"]` },
        { id: "menu-open", operation: "waitForState", target: "role:menu", timeoutMs: 2000 },
        { id: "move-to-trash", operation: "click", target: "role:menuitem:Move to trash" },
        { id: "trash-asked", operation: "waitForState", target: "role:dialog:Move to your trash?", timeoutMs: 2000 },
        { id: "confirm-move", operation: "click", target: "role:button:Move" },
        { id: "open-home-composer", operation: "click", target: "role:button:What's on your mind, Maya?" },
        { id: "home-composer-open", operation: "waitForState", target: "role:dialog:Create post", timeoutMs: 3000 },
        { id: "open-audience", operation: "click", target: "role:button:Edit privacy. Sharing with Friends." },
        { id: "audience-open", operation: "waitForState", target: "role:dialog:Post audience", timeoutMs: 2000 },
        { id: "choose-public", operation: "click", target: "role:radio:Public" },
        { id: "audience-done", operation: "click", target: "role:button:Done" },
        { id: "write-open-day", operation: "type", target: "role:textbox:What's on your mind, Maya?", value: MOVED_OPEN_DAY_TEXT },
        ...PRESS_POST_TWICE,
        { id: "reposted", operation: "waitForState", target: OWN_POST, timeoutMs: 5000 },
        { id: "extract-open-day", operation: "extract", target: OWN_POST, fields: { text: DIGEST_FIELDS.text, posted: DIGEST_FIELDS.posted } },
        { id: "open-day-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [buildIs("baseline"), path(ROOT)],
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-open-day", count: 1, records: [{ text: MOVED_OPEN_DAY_TEXT, posted: fullDateText(0) }] }],
        finalState: [path(ROOT)],
        allowedConsoleErrors: [],
      },
    },
  ],
});

/** The friends' own posts in the feed before "You're all caught up", with where each sits, under a rendering. */
function digestPositions(mode: FeedMode): Array<{ post: FeedPost; position: number }> {
  const plan = feedPlanFor({ mode, created: [], trashed: [], hidden: [] });
  return plan.batches.slice(0, plan.caughtUpAfter + 1).flat()
    .flatMap(({ unit, position }) => (unit.kind === "post" && unit.author !== MAYA.slug ? [{ post: unit, position }] : []));
}

/** The digest a correct run returns under a rendering: every friend's own post, once, whole, in feed order. */
function digest(mode: FeedMode) {
  const records = digestPositions(mode).map(({ post }) => ({
    author: personBySlug(post.author).name,
    group: post.group === undefined ? null : communityBySlug(post.group).name,
    posted: fullDateText(post.minutesAgo),
    text: post.text,
    reactions: post.reactions ?? null,
    comments: post.comments ?? null,
  }));
  return { step: "extract-feed-digest", count: records.length, records, optionalFields: ["group", "reactions", "comments"] };
}
