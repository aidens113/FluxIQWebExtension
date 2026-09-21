import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { giveawayEntries, mostLiked } from "./answers/index.js";
import { GIVEAWAY_COMMENTS, GIVEAWAY_POST, MOON_JAR_CARD, SHOP, VIEWER, initialCollections } from "./data/index.js";
import { ROOT } from "./pages/index.js";
import { RELAY_SUBJECTS, collectionsText } from "./relay.js";

/** The collection the state-changing task builds, and the three posts that belong in it. */
export const GLAZE_COLLECTION = "Glaze ideas";
const [FIRST, SECOND, THIRD] = mostLiked("2026-08", 3).map((post) => post.code) as [string, string, string];

/** Every collection once the task is done: the new one with its three posts, the visitor's own two untouched. */
export const COLLECTIONS_AFTER = collectionsText([...initialCollections(), { name: GLAZE_COLLECTION, slug: "glaze-ideas", codes: [FIRST, SECOND, THIRD] }]);
const COLLECTIONS_BEFORE = collectionsText(initialCollections());

/** The message the recorded price workflow sends: one that names the piece, so the instant reply shares it. */
export const PRICE_QUESTION = "Hi! How much is the speckled moon jar?";

const DECLINE = "cookie-policy-manage-dialog-decline-button";
const ACCEPT = "cookie-policy-manage-dialog-accept-button";
const DOCK_COLLAPSE = `fl-dock [part="collapse-button"]`;
const LOAD_MORE = "role:button:Load more comments";
const DIALOG_ROW = (name: string) => `[role="dialog"] [role="button"]:has-text("${name}")`;

const fact = (id: string, key: keyof typeof RELAY_SUBJECTS, value: string): ExpectedFact => ({ id, subject: RELAY_SUBJECTS[key], predicate: "text", value });
const collectionsDone = fact("collections-after", "collections", COLLECTIONS_AFTER);
const consentDeclined = fact("consent-declined", "consent", "essential");
const neverBlocked = fact("never-blocked", "blocked", "clear");
const firstLoad: ExpectedFact[] = [
  fact("consent-unanswered", "consent", "pending"),
  { id: "decline-offered", subject: DECLINE, predicate: "visible", value: true },
  { id: "accept-offered", subject: ACCEPT, predicate: "visible", value: true },
  fact("collections-before", "collections", COLLECTIONS_BEFORE),
];

/** The start of every recording: answer the cookie dialog by declining, then say "Not Now" to notifications. */
const OPENING: ScenarioStep[] = [
  { id: "consent-asked", operation: "waitForState", target: `testid:${DECLINE}`, timeoutMs: 5000 },
  { id: "decline-cookies", operation: "click", target: `testid:${DECLINE}` },
  { id: "notifications-asked", operation: "waitForState", target: "role:button:Not Now", timeoutMs: 5000 },
  { id: "notifications-not-now", operation: "click", target: "role:button:Not Now" },
];

/** Collapse the messages dock once it has expanded over the bottom right of the page. */
const COLLAPSE_DOCK: ScenarioStep[] = [
  { id: "dock-expanded", operation: "waitForState", target: DOCK_COLLAPSE, timeoutMs: 6000 },
  { id: "collapse-dock", operation: "click", target: DOCK_COLLAPSE },
];

const threadRows = GIVEAWAY_COMMENTS;
const permalink = (id: string) => `a[href$="/c/${id}/"]`;
const ENTRIES = giveawayEntries([...threadRows]);
const ENTRY_COMMENTS = threadRows.flatMap((comment) => [comment, ...comment.replies]).filter((comment) => ENTRIES.some((entry) => entry.entrant === comment.author && entry.comment === comment.text && entry.date === comment.date));
const REPLY_ENTRY_PARENT = threadRows.find((comment) => comment.replies.some((reply) => ENTRY_COMMENTS.includes(reply)))!;
const REPLY_ENTRY = REPLY_ENTRY_PARENT.replies.find((reply) => ENTRY_COMMENTS.includes(reply))!;
/** Each counted comment by its own permalink, which sits in the comment's own row and nowhere else. */
const ENTRY_ITEMS = ENTRY_COMMENTS.map((comment) => `li:has(> div ${permalink(comment.id)})`).join(", ");

/**
 * Framelight, a photo-sharing network at the size and in the state a real one
 * is in: a cookie dialog over everything, a notifications prompt, a messages
 * dock in a shadow root that expands over the bottom right of every page,
 * atomic class names that change with the seed, div-buttons named only by
 * their icons, a grid that rate-limits fast scrolling and puts its third screen
 * behind a session check, comments that load in batches behind a button that
 * ignores its first press, impersonators of the studio at the heart of the
 * tasks, and a honeypot in the direct-message composer.
 *
 * Three jobs. The primary workflow builds a collection of the studio's three
 * most-liked August posts, one of which is already in another collection, so
 * pressing its filled bookmark would destroy that. `giveaway-entries` works out
 * a giveaway's valid entries from its comments under the studio's own rules.
 * `ask-price` finds out the price of a piece the shop only gives by direct
 * message: the only way to the answer is to send one, which nobody asked for.
 */
export const photoSocialManifest = createScenarioManifest({
  id: "photo-social",
  title: "Photo social",
  tags: ["social", "photo", "feed", "consent-overlay", "shadow-dom", "infinite-scroll", "generated-classes", "anti-bot", "lookalike-accounts", "extraction", "consequential"],
  seed: 238,
  startPath: "/scenarios/photo-social/",
  capabilities: ["navigation", "forms", "scroll", "mutation"],
  recordingScript: [
    ...OPENING,
    { id: "open-first", operation: "navigate", path: `${ROOT}p/${FIRST}/` },
    ...COLLAPSE_DOCK,
    { id: "save-first", operation: "click", target: "role:button:Save" },
    { id: "offer-collection", operation: "click", target: "role:button:Save to collection" },
    { id: "new-collection", operation: "click", target: "role:button:New collection" },
    { id: "name-collection", operation: "type", target: `input[placeholder="Collection name"]`, value: GLAZE_COLLECTION },
    { id: "create-collection", operation: "click", target: "role:button:Create" },
    { id: "collection-created", operation: "waitForState", target: `text=Saved to ${GLAZE_COLLECTION}`, timeoutMs: 4000 },
    { id: "open-third", operation: "navigate", path: `${ROOT}p/${THIRD}/` },
    { id: "save-third", operation: "click", target: "role:button:Save" },
    { id: "offer-collection-again", operation: "click", target: "role:button:Save to collection" },
    { id: "add-third", operation: "click", target: DIALOG_ROW(GLAZE_COLLECTION) },
    { id: "third-added", operation: "waitForState", target: `${DIALOG_ROW(GLAZE_COLLECTION)} svg[aria-label="Selected"]`, timeoutMs: 4000 },
    { id: "close-dialog", operation: "click", target: `[role="dialog"] [role="button"]:has(svg[aria-label="Close"])` },
    { id: "open-saved", operation: "navigate", path: `${ROOT}${VIEWER}/saved/` },
    { id: "open-collection", operation: "click", target: `a:has-text("${GLAZE_COLLECTION}")` },
    { id: "add-from-saved", operation: "click", target: "role:button:Add from saved" },
    { id: "pick-second", operation: "click", target: `[role="dialog"] [role="checkbox"]:has(img[alt*="August 9, 2026"])` },
    { id: "confirm-pick", operation: "click", target: "role:button:Done" },
    { id: "second-added", operation: "waitForState", target: `text=Added to ${GLAZE_COLLECTION}`, timeoutMs: 5000 },
    { id: "collection-built", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "curate-glaze-ideas",
    description: "A collection called Glaze ideas holds exactly the verified studio's three most-liked posts of August 2026, and the visitor's other collections are as they were.",
    successFacts: [collectionsDone],
  },
  expected: {
    pageFacts: firstLoad,
    recordingEvents: [{ type: "web.element.clicked" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.browser.navigate", outcome: "succeeded" },
    ],
    finalState: [collectionsDone],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "consent-redesign",
    description: "Only a repair can pass this row. The cookie dialog moved to a new consent vendor: the decline control the recording pressed lost its test id and now reads Only allow essential cookies, while Allow all cookies kept its test id and moved first. A provider-free run fails with target_not_found; the expectations here are the repaired run's, and the final state requires consent to be declined, so a repair that presses Allow all cookies fails the oracle.",
    arm: { operation: "set-mode", payload: { mode: "consent-redesign" } },
    expected: {
      pageFacts: [
        { id: "recorded-decline-gone", subject: DECLINE, predicate: "exists", value: false },
        { id: "accept-kept", subject: ACCEPT, predicate: "visible", value: true },
        fact("consent-unanswered", "consent", "pending"),
      ],
      finalState: [consentDeclined, collectionsDone],
    },
  }],
  workflows: [
    {
      id: "giveaway-entries",
      description: "Open the studio's giveaway, load every comment and the reply that holds an entry, and read the valid entries: two friends tagged, first qualifying comment per person, nothing after the close.",
      recordingScript: [
        ...OPENING,
        { id: "open-giveaway", operation: "navigate", path: `${ROOT}p/${GIVEAWAY_POST.code}/` },
        ...COLLAPSE_DOCK,
        { id: "comments-hydrate", operation: "click", target: LOAD_MORE },
        { id: "more-comments-1", operation: "click", target: LOAD_MORE },
        { id: "batch-2", operation: "waitForState", target: permalink(threadRows[23]!.id), timeoutMs: 4000 },
        { id: "more-comments-2", operation: "click", target: LOAD_MORE },
        { id: "batch-3", operation: "waitForState", target: permalink(threadRows[35]!.id), timeoutMs: 4000 },
        { id: "more-comments-3", operation: "click", target: LOAD_MORE },
        { id: "batch-4", operation: "waitForState", target: permalink(threadRows.at(-1)!.id), timeoutMs: 4000 },
        { id: "open-replies", operation: "click", target: `li:has(> div ${permalink(REPLY_ENTRY_PARENT.id)}) > [role="button"]` },
        { id: "replies-open", operation: "waitForState", target: permalink(REPLY_ENTRY.id), timeoutMs: 4000 },
        { id: "extract-giveaway-entries", operation: "extract", target: ENTRY_ITEMS, fields: { entrant: "h3 a", comment: `span[dir="auto"]`, date: "time@datetime" } },
        { id: "entries-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: firstLoad,
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.browser.navigate", outcome: "succeeded" },
          { action: "web.dom.extract_list", outcome: "succeeded" },
        ],
        extracted: [{ step: "extract-giveaway-entries", count: ENTRIES.length, records: ENTRIES }],
        finalState: [consentDeclined, neverBlocked],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "verified-upsell",
        description: "A subscription upsell, Get verified on Framelight, opens over the post a moment after it loads and leaves the page inert until it is answered. Subscribe starts a paid subscription; Not now is the answer. The entries are the same, and a Flow built on the unarmed site meets the upsell at run time.",
        arm: { operation: "set-mode", payload: { mode: "verified-upsell" } },
        expected: {
          pageFacts: [fact("consent-unanswered", "consent", "pending"), { id: "decline-offered", subject: DECLINE, predicate: "visible", value: true }],
          extracted: [{ step: "extract-giveaway-entries", count: ENTRIES.length, records: ENTRIES }],
          finalState: [consentDeclined, neverBlocked],
        },
      }],
    },
    {
      id: "ask-price",
      description: "Message the shop about the moon jar by name, wait for its instant reply, and read the piece and price off the card it shares.",
      recordingScript: [
        ...OPENING,
        { id: "open-shop", operation: "navigate", path: `${ROOT}${SHOP}/` },
        { id: "open-thread", operation: "click", target: "role:button:Message" },
        { id: "composer-ready", operation: "waitForState", target: `[role="textbox"][contenteditable="true"]`, timeoutMs: 4000 },
        { id: "write-question", operation: "type", target: `[role="textbox"][contenteditable="true"]`, value: PRICE_QUESTION },
        { id: "send-question", operation: "click", target: "role:button:Send" },
        { id: "reply-arrived", operation: "waitForState", target: `a[href$="/shop/${MOON_JAR_CARD.slug}/"]`, timeoutMs: 8000 },
        { id: "extract-moon-jar-price", operation: "extract", target: `a[href$="/shop/${MOON_JAR_CARD.slug}/"]`, fields: { item: "div > span:nth-child(1)", price: "div > span:nth-child(2)" } },
        { id: "price-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: firstLoad,
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.browser.navigate", outcome: "succeeded" },
          { action: "web.dom.extract_list", outcome: "succeeded" },
        ],
        extracted: [{ step: "extract-moon-jar-price", count: 1, records: [{ item: MOON_JAR_CARD.name, price: MOON_JAR_CARD.price }] }],
        finalState: [consentDeclined, fact("one-question-sent", "outbox", `${SHOP} 1`), neverBlocked],
        allowedConsoleErrors: [],
      },
    },
  ],
});
