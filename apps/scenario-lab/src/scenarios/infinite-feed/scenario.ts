import { createScenarioManifest, defineScenario } from "../../types.js";
import { FEED_PAGE_SIZE, feedItem } from "./feed-content.js";
import { FEED_PAGE_HEIGHT_PX, renderFeedDocument, renderFeedPage } from "./feed-markup.js";

export type InfiniteFeedMode = "baseline" | "end-early" | "load-more";

export type InfiniteFeedState = {
  mode: InfiniteFeedMode;
  /** Posts the feed holds before its end-of-feed marker. */
  feedLength: number;
  /** Posts the open feed shows: one page at open, one more page per scroll-triggered load. */
  loadedCount: number;
  ended: boolean;
  /** Times a start document opened the feed; each open starts a fresh session at page one. */
  sessions: number;
  lastOperation: "seeded" | "opened" | "page-loaded" | "mode-set";
};

const feedLengths: Record<InfiniteFeedMode, number> = { baseline: 60, "end-early": 25, "load-more": 60 };

/**
 * The seed the expected records below are the content of. A run starts the lab
 * on the scenario's own seed unless `--seed` overrides it
 * (`test-runner/src/run-scenario.ts`), and this feed's posts are a function of
 * that seed, so the records hold at this seed and no other.
 */
const FEED_SEED = 116;

/** Read inside each post: the title and author as text, and the timestamp as the `datetime` attribute rather than the text beside it. */
const feedFields = { title: "testid:feed-item-title", author: "testid:feed-item-author", published: "testid:feed-item-time@datetime" };

/** The first `count` posts as the page renders them, newest first. */
function feedRecords(count: number): Array<Record<string, string>> {
  return Array.from({ length: count }, (_, index) => {
    const { title, author, published } = feedItem(FEED_SEED, index + 1);
    return { title, author, published };
  });
}

/**
 * One page plus a quarter: the document bottom clamps every step, so each
 * step reaches the sentinel and triggers exactly one page load. Three steps
 * after the first page make the 40 posts W11 extracts.
 */
const SCROLL_STEP_PX = FEED_PAGE_HEIGHT_PX + FEED_PAGE_HEIGHT_PX / 4;
const PAGE_WAIT_MS = 5000;
const extractStep = "extract-loaded-posts";

export const infiniteFeedScenario = defineScenario<InfiniteFeedState>({
  id: "infinite-feed", title: "Infinite feed", startPath: "/scenarios/infinite-feed/", seed: FEED_SEED,
  manifest: createScenarioManifest({
    id: "infinite-feed", title: "Infinite feed", tags: ["scroll", "infinite-scroll", "lazy-load", "extraction"], seed: FEED_SEED,
    startPath: "/scenarios/infinite-feed/", capabilities: ["scroll", "mutation"],
    recordingScript: [
      { id: "scroll-to-page-2", operation: "scroll", value: SCROLL_STEP_PX },
      { id: "page-2-loaded", operation: "waitForState", target: "testid:feed-page-2", timeoutMs: PAGE_WAIT_MS },
      { id: "scroll-to-page-3", operation: "scroll", value: SCROLL_STEP_PX },
      { id: "page-3-loaded", operation: "waitForState", target: "testid:feed-page-3", timeoutMs: PAGE_WAIT_MS },
      { id: "scroll-to-page-4", operation: "scroll", value: SCROLL_STEP_PX },
      { id: "page-4-loaded", operation: "waitForState", target: "testid:feed-page-4", timeoutMs: PAGE_WAIT_MS },
      { id: extractStep, operation: "extract", target: "testid:feed-item", fields: feedFields },
      { id: "posts-extracted", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.scroll.changed", count: 3 }],
      actions: [{ action: "web.dom.scroll", outcome: "succeeded" }],
      extracted: [{ step: extractStep, count: 40, records: feedRecords(40) }],
      finalState: [
        { id: "forty-posts-loaded", subject: "feed-status", predicate: "text", value: "Showing 40 posts" },
        { id: "page-4-present", subject: "feed-page-4", predicate: "exists", value: true },
        { id: "page-5-absent", subject: "feed-page-5", predicate: "exists", value: false },
        { id: "feed-continues", subject: "feed-end", predicate: "visible", value: false },
      ],
      allowedConsoleErrors: [],
    },
    variants: [{
      id: "end-early",
      description: "The feed ends after 25 posts: the third page holds five posts and shows the end-of-feed marker, so the run succeeds with 25 extracted posts.",
      arm: { operation: "set-mode", payload: { mode: "end-early" } },
      expected: {
        extracted: [{ step: extractStep, count: 25, records: feedRecords(25) }],
        finalState: [
          { id: "all-posts-loaded", subject: "feed-status", predicate: "text", value: "Showing all 25 posts" },
          { id: "end-of-feed-shown", subject: "feed-end", predicate: "visible", value: true },
          { id: "page-4-absent", subject: "feed-page-4", predicate: "exists", value: false },
        ],
      },
    }],
    workflows: [
      {
        id: "extract-until-end",
        description: "Extract every post in one read, scrolling to load more until the feed ends, rather than stopping at the posts that happen to be on screen.",
        recordingScript: [
          { id: "extract-every-post", operation: "extract", target: "testid:feed-item", fields: feedFields, pagination: { mode: "scroll", maxScrolls: 20 } },
          { id: "every-post-extracted", operation: "checkpoint" },
        ],
        expected: {
          extracted: [{ step: "extract-every-post", count: feedLengths.baseline, records: feedRecords(feedLengths.baseline) }],
          finalState: [
            { id: "whole-feed-loaded", subject: "feed-status", predicate: "text", value: `Showing all ${feedLengths.baseline} posts` },
            { id: "feed-ended", subject: "feed-end", predicate: "visible", value: true },
          ],
        },
      },
      {
        id: "extract-by-load-more",
        description: "Extract the feed where the next page comes from pressing a control rather than from scrolling. Unarmed, this feed scrolls and no such control exists, so the read returns the first page and stops instead of waiting for a button that is never coming.",
        recordingScript: [
          { id: "extract-paged-posts", operation: "extract", target: "testid:feed-item", fields: feedFields, pagination: { mode: "loadMore", control: "testid:load-more", maxPages: 10 } },
          { id: "paged-posts-extracted", operation: "checkpoint" },
        ],
        expected: {
          extracted: [{ step: "extract-paged-posts", count: FEED_PAGE_SIZE, records: feedRecords(FEED_PAGE_SIZE), pages: 1 }],
          finalState: [
            { id: "first-page-only", subject: "feed-status", predicate: "text", value: `Showing ${FEED_PAGE_SIZE} posts` },
            { id: "no-load-more-control", subject: "load-more", predicate: "exists", value: false },
          ],
        },
        variants: [{
          id: "load-more-button",
          description: "The feed pages by a Load more button instead of by scrolling: the sentinel is gone, so nothing loads on its own and every page after the first comes from pressing the control.",
          arm: { operation: "set-mode", payload: { mode: "load-more" } },
          expected: {
            extracted: [{
              step: "extract-paged-posts", count: feedLengths["load-more"],
              records: feedRecords(feedLengths["load-more"]), pages: feedLengths["load-more"] / FEED_PAGE_SIZE,
            }],
            finalState: [
              { id: "whole-feed-loaded", subject: "feed-status", predicate: "text", value: `Showing all ${feedLengths["load-more"]} posts` },
              { id: "feed-ended", subject: "feed-end", predicate: "visible", value: true },
              { id: "control-spent", subject: "load-more", predicate: "exists", value: false },
            ],
          },
        }],
      },
    ],
  }),
  createState: () => ({ mode: "baseline", feedLength: feedLengths.baseline, loadedCount: FEED_PAGE_SIZE, ended: false, sessions: 0, lastOperation: "seeded" }),
  mutate(state, operation, payload) {
    if (operation === "open") {
      return withLoaded({ ...state, sessions: state.sessions + 1, lastOperation: "opened" }, FEED_PAGE_SIZE);
    }
    if (operation === "load-page" && isRecord(payload) && typeof payload.page === "number" && payload.page === nextPage(state)) {
      return withLoaded({ ...state, lastOperation: "page-loaded" }, payload.page * FEED_PAGE_SIZE);
    }
    if (operation === "set-mode" && isRecord(payload) && isFeedMode(payload.mode)) {
      const feedLength = feedLengths[payload.mode];
      return withLoaded({ ...state, mode: payload.mode, feedLength, lastOperation: "mode-set" }, state.loadedCount);
    }
    return state;
  },
  render(state, context) {
    return renderFeedDocument(state.feedLength, context, state.mode === "load-more" ? "load-more" : "scroll");
  },
  route(state, request, context) {
    const match = /^page\/([1-9]\d*)$/.exec(request.subpath);
    if (!match) return undefined;
    const pageNumber = Number(match[1]);
    if (pageNumber < 2 || pageNumber > Math.ceil(state.feedLength / FEED_PAGE_SIZE)) return undefined;
    // Pages load strictly in order within a session; anything else would
    // put posts on screen that the fixture state does not record.
    if (pageNumber !== nextPage(state)) return { status: 409, body: "" };
    return {
      status: 200,
      body: renderFeedPage(context.seed, pageNumber, state.feedLength),
      mutation: { operation: "load-page", payload: { page: pageNumber } },
    };
  },
});

/** The page a load would append next, or `undefined` once the feed has ended. */
function nextPage(state: InfiniteFeedState): number | undefined {
  return state.ended ? undefined : Math.ceil(state.loadedCount / FEED_PAGE_SIZE) + 1;
}

function withLoaded(state: InfiniteFeedState, loadedCount: number): InfiniteFeedState {
  const clamped = Math.min(loadedCount, state.feedLength);
  return { ...state, loadedCount: clamped, ended: clamped >= state.feedLength };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A mode the fixture knows, so an unknown one arms nothing rather than clearing the feed. */
function isFeedMode(value: unknown): value is InfiniteFeedMode {
  return typeof value === "string" && Object.hasOwn(feedLengths, value);
}
